"""Actual disposable SQLite and HTTP tests. Never contacts production services."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('attendance', Path(__file__).resolve().parents[1]/'tools/local_attendance_server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def uid(n):
    return '00000000-0000-4000-8000-'+str(n).zfill(12)


class AttendanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)/'attendance.sqlite3'
        self.db = module.AttendanceDB(self.path, now=lambda: '2026-11-02T07:30:00+00:00')
        self.registry = {'registry':uid(1),'revision':1,'cohorts':[{'id':uid(2),'name':'TEST COHORT'},{'id':uid(3),'name':'OTHER TEST COHORT'}], 'profiles':[{'id':uid(i),'display_name':'TEST ONLY '+str(i),'role':'mentee','active':True} for i in (4,5,6)], 'enrolments':[{'cohort_id':uid(2 if i in (4,5) else 3),'user_id':uid(i),'role':'mentee','active':True} for i in (4,5,6)]}
        self.db.sync(self.registry)
        self.event = {'registry':uid(1),'id':uid(10),'cohort':uid(2),'name':'TEST CLASS','kind':'Common Class','starts_at':'2026-11-02T14:00:00+07:00','ends_at':'2026-11-02T15:00:00+07:00','participants':[uid(4)]}
        self.db.event(self.event)

    def tearDown(self):
        self.temp.cleanup()

    def scan_payload(self, user=4):
        card = self.db.card({'registry':uid(1),'mentee':uid(user)})
        self.assertNotIn(uid(user), card['payload'])
        return {'registry':uid(1),'event':uid(10),'payload':card['payload']}

    def state(self):
        return self.db.state({'registry':uid(1),'cohort':uid(2)})

    def test_scan_persists_on_correct_mentee_and_database_reopen(self):
        result = self.db.scan(self.scan_payload())
        self.assertEqual(result['attendance']['user_id'], uid(4))
        self.assertEqual(result['attendance']['status'], 'Hadir')
        reopened = module.AttendanceDB(self.path)
        state = reopened.state({'registry':uid(1),'cohort':uid(2)})
        self.assertEqual(len(state['attendance']), 1)
        self.assertEqual(len(state['history']), 1)
        self.assertEqual(state['history'][0]['operator'], 'Pengurus lokal')

    def test_concurrent_duplicate_scan_does_not_duplicate_or_change_timestamp(self):
        payload = self.scan_payload()
        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(lambda _:self.db.scan(payload), range(2)))
        self.assertEqual(sorted(x['duplicate'] for x in results), [False,True])
        state = self.state()
        self.assertEqual(len(state['attendance']), 1)
        self.assertEqual(len(state['history']), 1)
        self.assertEqual(results[0]['attendance']['recorded_at'], results[1]['attendance']['recorded_at'])

    def test_wrong_participant_and_cohort_invalid_qr_and_closed_or_future_event(self):
        for user in (5,6):
            with self.assertRaises(module.Invalid):self.db.scan(self.scan_payload(user))
        with self.assertRaises(module.Invalid):self.db.scan({'registry':uid(1),'event':uid(10),'payload':'not a card'})
        with self.assertRaises(module.Invalid):self.db.scan({'registry':uid(1),'event':uid(10),'payload':'ipbleap:attendance:v1:unknown'})
        future = {**self.event,'id':uid(11),'starts_at':'2027-01-01T00:00:00+07:00','ends_at':'2027-01-01T01:00:00+07:00'}
        self.db.event(future)
        with self.assertRaises(module.Invalid):self.db.scan({**self.scan_payload(),'event':uid(11)})
        self.db.close({'registry':uid(1),'event':uid(10),'expected':1})
        with self.assertRaises(module.Invalid):self.db.scan(self.scan_payload())
        self.assertEqual(self.state()['attendance'], [])

    def test_correction_keeps_history_requires_reason_and_conflict_check(self):
        self.db.scan(self.scan_payload())
        p={'registry':uid(1),'event':uid(10),'mentee':uid(4),'status':'Izin','reason':'TEST APPROVED LEAVE','expected':1}
        self.db.correct(p)
        with self.assertRaises(module.Invalid):self.db.correct(p)
        with self.assertRaises(module.Invalid):self.db.correct({**p,'expected':2,'reason':''})
        with self.assertRaises(module.Invalid):self.db.scan(self.scan_payload())
        s=self.state()
        self.assertEqual(s['attendance'][0]['status'], 'Izin')
        self.assertEqual(s['attendance'][0]['revision'], 2)
        self.assertEqual(len(s['history']), 2)
        self.assertEqual(s['history'][-1]['previous_status'], 'Hadir')

    def test_deactivated_mentee_cannot_scan_and_stale_registry_cannot_overwrite(self):
        payload=self.scan_payload()
        updated=json.loads(json.dumps(self.registry));updated['revision']=2;updated['profiles'][0]['active']=False
        self.db.sync(updated)
        with self.assertRaises(module.Invalid):self.db.scan(payload)
        with self.assertRaises(module.Invalid):self.db.sync(self.registry)
        self.assertEqual(self.state()['attendance'], [])

    def test_foreign_keys_and_registry_ownership(self):
        with self.db.connect() as db:
            with self.assertRaises(sqlite3.IntegrityError):db.execute('insert into participants values(?,?)',(uid(999),uid(4)))
        with self.assertRaises(module.Invalid):self.db.sync({**self.registry,'registry':uid(99)})
        with self.assertRaises(module.Invalid):self.db.event({**self.event,'id':uid(12),'ends_at':self.event['starts_at']})
        self.assertTrue(self.db.event(self.event)['duplicate'])
        with self.assertRaises(module.Invalid):self.db.event({**self.event,'name':'MUST NOT SILENTLY CHANGE'})

    def test_http_cookie_csrf_origin_and_private_database_path(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),module.handler_for(self.db,Path(self.temp.name)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        origin='http://127.0.0.1:'+str(server.server_port)
        def call(method,path,data=None,headers=None):
            c=HTTPConnection('127.0.0.1',server.server_port,timeout=3)
            c.request(method,path,json.dumps(data) if data else None,headers or {})
            response=c.getresponse();status=response.status;h=dict(response.getheaders());body=json.loads(response.read());c.close();return status,h,body
        self.assertEqual(call('POST','/api/local/attendance/state',{'cohort':uid(2)})[0],403)
        status,headers,boot=call('GET','/api/local/attendance/bootstrap')
        self.assertEqual(status,200)
        auth={'Cookie':headers['Set-Cookie'].split(';')[0],'X-LEAP-CSRF':boot['csrf'],'Content-Type':'application/json','Origin':origin}
        self.assertEqual(call('POST','/api/local/attendance/state',{'registry':uid(1),'cohort':uid(2)},auth)[0],200)
        self.assertEqual(call('POST','/api/local/attendance/state',{'registry':uid(1),'cohort':uid(2)},{**auth,'Origin':'https://other.example'})[0],403)
        self.assertEqual(call('GET','/data-lokal/kehadiran.sqlite3')[0],403)


if __name__=='__main__':unittest.main()
