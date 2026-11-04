import copy
import json
import sys
import tempfile
import unittest
import uuid
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local'))
from model import Store, Invalid, Conflict, CATALOG


class Workflow(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.tmp.name) / 'test.sqlite3', date(2026, 11, 4))
        self.track = 'social'

    def tearDown(self):
        self.tmp.cleanup()

    def state(self, role='mentee'):
        return self.store.view(self.track, role)

    def cmd(self, role, action, data):
        return self.store.command(self.track, role, action, data, self.state(role)['revision'])

    def canvas(self):
        k = next(t for t in CATALOG if t['id'] == self.track)['kpis'][0]
        return {'goal': 'TEST GOAL', 'why': 'TEST WHY', 'reality': 'TEST BASELINE', 'options': 'TEST OPTIONS', 'wayForward': 'TEST FIRST ACTION', 'mentorNeed': 'TEST SUPPORT', 'kpis': [{'id': k['id'], 'baseline': 'TEST INITIAL STATE', 'measurement': 'TEST EVIDENCE STANDARD', 'milestones': {'3': 'TEST M3', '6': 'TEST M6', '9': 'TEST M9', '12': k['label']}}]}

    def agree(self):
        self.cmd('mentee', 'canvas_submit', self.canvas())
        self.cmd('asmen', 'canvas_check', {'decision': 'Siap dibahas Mentor', 'comment': 'TEST CHECK'})
        self.cmd('mentor', 'canvas_agree', {'comment': 'TEST AGREEMENT'})

    def note(self, due='2026-11-04'):
        s = self.cmd('mentee', 'note_submit', {'data': {'date': '2026-11-03', 'learning': 'TEST LEARNING', 'action': 'TEST ACTION', 'due': due, 'mentorNeed': 'TEST NEED'}})
        return s['notes'][-1]['id']

    def complete(self, id):
        self.cmd('mentee', 'outcome_save', {'id': id, 'status': 'Selesai', 'result': 'TEST VERIFIED RESULT', 'completed': '2026-11-04', 'url': 'https://example.org/proof'})
        self.cmd('asmen', 'action_check', {'id': id, 'execution': 10, 'timeliness': 10, 'evidence': 5, 'comment': 'TEST ASMEN REASON'})

    def review(self, level=75):
        self.cmd('mentor', 'review_save', {'period': 3, 'items': [{'id': self.canvas()['kpis'][0]['id'], 'actual': 'TEST ACTUAL', 'reason': 'TEST REASON', 'evidence': 'TEST EXAMINED DOCUMENT', 'level': level}]})

    def session(self):
        return {'id': str(uuid.uuid4()), 'status': 'Tercatat', 'data': {'kind': 'group', 'number': '1', 'date': '2026-11-04', 'duration': 60, 'theme': '', 'format': 'Online', 'topic': 'TEST SESSION TOPIC', 'summary': 'TEST SESSION DISCUSSION', 'attendance': [{'id': 'testPerson', 'name': 'TEST PARTICIPANT', 'status': 'Hadir'}], 'actions': [{'text': 'TEST FOLLOW-UP', 'who': 'testPerson', 'due': '2026-11-05'}], 'photoUrl': '', 'materialUrl': ''}}

    def test_staff_session_does_not_require_grow_and_keeps_history(self):
        d = self.session()
        s = self.cmd('asmen', 'session_save', d)
        self.assertIsNone(s['canvas'])
        self.assertEqual(s['sessions'][0]['version'], 1)
        self.assertEqual(self.state('mentee')['sessions'][0]['data']['theme'], '')
        d['data']['summary'] = 'TEST UPDATED DISCUSSION'
        s = self.cmd('mentor', 'session_save', d)
        self.assertEqual(s['sessions'][0]['version'], 2)
        self.assertEqual(s['sessions'][0]['history'][0]['data']['summary'], 'TEST SESSION DISCUSSION')
        d['status'] = 'Draft'
        with self.assertRaises(Invalid):
            self.cmd('asmen', 'session_save', d)

    def test_draft_session_private_to_staff_and_session_roles(self):
        d = self.session()
        d['status'] = 'Draft'
        self.cmd('asmen', 'session_save', d)
        self.assertEqual(self.state('mentee')['sessions'], [])
        self.assertEqual(len(self.state('mentor')['sessions']), 1)
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'session_save', self.session())

    def test_session_checks_attendance_participants_links_and_date(self):
        d = self.session()
        d['data']['attendance'][0]['status'] = ''
        with self.assertRaises(Invalid):
            self.cmd('asmen', 'session_save', d)
        d = self.session()
        d['data']['actions'][0]['who'] = 'NOT IN THIS SESSION'
        with self.assertRaises(Invalid):
            self.cmd('mentor', 'session_save', d)
        d = self.session()
        d['data']['date'] = '2026-11-05'
        with self.assertRaises(Invalid):
            self.cmd('asmen', 'session_save', d)
        d = self.session()
        d['data']['materialUrl'] = 'javascript:alert(1)'
        with self.assertRaises(Invalid):
            self.cmd('asmen', 'session_save', d)

    def test_mentee_note_available_before_grow(self):
        n = self.note()
        s = self.state()
        self.assertIsNone(s['notes'][0]['canvasVersion'])
        self.assertEqual(s['notes'][0]['id'], n)
        with self.assertRaises(Invalid):
            self.review()

    def test_mentee_session_details_persist_in_draft_and_submission(self):
        values = {'date': '2026-11-04', 'kind': '1-on-1', 'number': '2', 'time': '10:30', 'theme': '', 'format': 'Online', 'topic': 'TEST MENTORING TOPIC', 'learning': 'TEST LEARNING', 'action': 'TEST NEXT ACTION', 'due': '2026-11-05'}
        s = self.cmd('mentee', 'note_save', {'data': values})
        note_id = s['notes'][0]['id']
        self.assertEqual(self.state()['notes'][0]['data'], values)
        self.assertEqual(self.state('asmen')['notes'], [])
        self.cmd('mentee', 'note_submit', {'id': note_id, 'data': values})
        self.assertEqual(self.state('mentor')['notes'][0]['data'], values)
        self.assertEqual(self.state('mentor')['notes'][0]['id'], note_id)

    def test_mentee_session_details_reject_invalid_time_and_options(self):
        values = {'date': '2026-11-04', 'learning': 'TEST LEARNING', 'action': 'TEST ACTION', 'due': '2026-11-05'}
        for key, bad in [('time', '25:75'), ('kind', 'INVALID SESSION'), ('format', 'INVALID FORMAT')]:
            with self.assertRaises(Invalid):
                self.cmd('mentee', 'note_submit', {'data': {**values, key: bad}})

    def test_mentee_can_link_recorded_session_before_grow(self):
        d = self.session()
        self.cmd('asmen', 'session_save', d)
        note = {'data': {'date': '2026-11-04', 'learning': 'TEST LEARNING', 'action': 'TEST NEXT ACTION', 'due': '2026-11-05', 'session': d['id']}}
        s = self.cmd('mentee', 'note_submit', note)
        self.assertEqual(s['notes'][0]['sessionVersion'], 1)
        self.assertIsNone(s['notes'][0]['canvasVersion'])
        note['data']['date'] = '2026-11-03'
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'note_submit', note)
        note['data']['date'] = '2026-11-04'
        note['data']['session'] = str(uuid.uuid4())
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'note_submit', note)

    def test_catalog_all_tracks_and_original_north_stars(self):
        self.assertEqual(len(CATALOG), 5)
        self.assertEqual(sum(len(t['kpis']) for t in CATALOG), 16)
        self.assertEqual(CATALOG[0]['northStar'], 'Rp500 juta Cumulative Annual Revenue')
        self.assertEqual(next(t for t in CATALOG if t['id'] == 'social')['northStar'], '1 Sustainable Impact')

    def test_draft_privacy_role_scope_and_no_cross_track_data(self):
        self.cmd('mentee', 'canvas_save', self.canvas())
        self.assertIsNone(self.state('asmen')['canvas'])
        self.assertIsNone(self.store.view('academic', 'mentee')['canvas'])
        with self.assertRaises(Invalid):
            self.cmd('asmen', 'canvas_submit', self.canvas())
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'publish', {'period': 3})

    def test_catalog_and_final_milestone_cannot_be_forged(self):
        d = self.canvas()
        d['kpis'][0]['id'] = 'professionalContract'
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'canvas_submit', d)
        d = self.canvas()
        d['kpis'][0]['milestones']['12'] = 'LOWER UNAPPROVED TARGET'
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'canvas_submit', d)

    def test_return_resubmit_and_fixed_agreed_canvas(self):
        self.cmd('mentee', 'canvas_submit', self.canvas())
        with self.assertRaises(Invalid):
            self.cmd('mentor', 'canvas_agree', {'comment': 'TOO EARLY'})
        self.cmd('asmen', 'canvas_check', {'decision': 'Perlu perbaikan', 'comment': 'CLARIFY'})
        self.cmd('mentee', 'canvas_submit', self.canvas())
        self.cmd('asmen', 'canvas_check', {'decision': 'Siap dibahas Mentor', 'comment': 'READY'})
        self.cmd('mentor', 'canvas_agree', {'comment': 'AGREED'})
        self.assertEqual(len(self.state()['canvasHistory']), 1)
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'canvas_save', self.canvas())

    def test_frozen_submission_date_and_safe_evidence(self):
        self.agree()
        n = self.note()
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'note_save', {'id': n, 'data': {}})
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'outcome_save', {'id': n, 'status': 'Sebagian', 'result': 'TEST RESULT', 'url': 'javascript:alert(1)'})
        with self.assertRaises(Invalid):
            self.cmd('mentee', 'note_submit', {'data': {'date': '2026-11-05', 'learning': 'X', 'action': 'Y', 'due': '2026-11-06'}})

    def test_waiting_not_zero_and_late_claim_rejected(self):
        self.agree()
        n = self.note('2026-11-10')
        self.assertIsNone(self.state()['scores']['3']['asmen'])
        self.assertEqual(self.state()['scores']['3']['waiting'], 1)
        with self.assertRaises(Invalid):
            self.cmd('asmen', 'action_check', {'id': n, 'execution': 0, 'timeliness': 0, 'evidence': 0, 'comment': 'NOT DUE'})

    def test_full_score_publish_snapshot_and_stale_sources(self):
        self.agree()
        n = self.note()
        self.complete(n)
        self.review()
        result = self.state()['scores']['3']
        self.assertEqual(result['asmen'], 25)
        self.assertEqual(result['mentor'], 52.5)
        self.assertEqual(result['total'], 77.5)
        self.cmd('mentor', 'publish', {'period': 3})
        frozen = copy.deepcopy(self.state()['publications'][0])
        self.cmd('mentee', 'outcome_save', {'id': n, 'status': 'Selesai', 'result': 'REVISED RESULT', 'completed': '2026-11-04', 'url': ''})
        self.assertIsNone(self.state()['scores']['3']['total'])
        self.assertEqual(self.state()['publications'][0], frozen)
        with self.assertRaises(Invalid):
            self.cmd('mentor', 'publish', {'period': 3})

    def test_zero_score_and_concurrent_revision(self):
        self.agree()
        n = self.note('2026-11-03')
        self.cmd('asmen', 'action_check', {'id': n, 'execution': 0, 'timeliness': 0, 'evidence': 0, 'comment': 'NO ACTION REPORTED'})
        self.review(0)
        self.assertEqual(self.state()['scores']['3']['total'], 0)
        old = self.state()['revision']
        self.cmd('mentor', 'support_reply', {'key': 'canvas', 'reply': 'TEST REPLY', 'status': 'Dibahas'})
        with self.assertRaises(Conflict):
            self.store.command(self.track, 'mentor', 'support_reply', {'key': 'canvas', 'reply': 'OVERWRITE', 'status': 'Dibahas'}, old)
        self.assertEqual(self.state()['supportReplies']['canvas']['reply'], 'TEST REPLY')


if __name__ == '__main__':
    unittest.main()
