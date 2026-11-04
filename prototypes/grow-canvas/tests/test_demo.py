import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'local'))
from demo import DEMO_DATE, seed_assessment, workspace_store
from model import Store, Invalid


class AssessmentPractice(unittest.TestCase):
    def test_practice_can_be_scored_without_touching_normal_workspace(self):
        with tempfile.TemporaryDirectory() as folder:
            server = SimpleNamespace(store=Store(Path(folder) / 'normal.sqlite3', DEMO_DATE),
                                     demo_store=Store(Path(folder) / 'practice.sqlite3', DEMO_DATE))
            normal = server.store.view('social', 'mentee')
            seed_assessment(server.demo_store)
            self.assertIs(workspace_store(server, None), server.store)
            self.assertIs(workspace_store(server, 'assessment'), server.demo_store)
            with self.assertRaises(Invalid):
                workspace_store(server, 'unknown')

            def cmd(role, action, data):
                store = workspace_store(server, 'assessment')
                return store.command('social', role, action, data, store.view('social', role)['revision'])

            state = server.demo_store.view('social', 'asmen')
            self.assertEqual(state['canvas']['status'], 'Disepakati')
            self.assertIsNone(state['scores']['3']['total'])
            note = state['notes'][0]
            state = cmd('asmen', 'action_check', {'id': note['id'], 'execution': 10, 'timeliness': 10,
                                                'evidence': 5, 'comment': 'Selesai tepat waktu, rincian bukti belum lengkap.'})
            self.assertEqual(state['scores']['3']['asmen'], 25)
            state = cmd('mentor', 'review_save', {'period': 3, 'items': [{'id': 'socialBeneficiaries',
                'actual': '75 orang dari 100 orang.', 'evidence': 'Rekap latihan 75 orang unik.',
                'reason': '75 persen target tercapai.', 'level': 75}]})
            self.assertEqual(state['scores']['3']['mentor'], 52.5)
            self.assertEqual(state['scores']['3']['total'], 77.5)
            state = cmd('mentor', 'publish', {'period': 3})
            self.assertEqual(state['publications'][0]['score']['total'], 77.5)
            seed_assessment(server.demo_store)
            self.assertEqual(server.demo_store.view('social', 'mentor')['revision'], state['revision'])
            self.assertEqual(server.store.view('social', 'mentee'), normal)


if __name__ == '__main__':
    unittest.main()
