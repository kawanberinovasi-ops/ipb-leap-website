// Identity only on retained prototype modules; does not fetch personal assessment answers.
import {verifiedUser,bootstrap} from './api.mjs';
try{if(await verifiedUser()){window.leapAccount=await bootstrap();const query=new URLSearchParams(location.search);window.leapContext=Object.fromEntries(['cohort','mentee','group','period','source'].filter(k=>query.has(k)).map(k=>[k,query.get(k)]));window.dispatchEvent(new CustomEvent('leap:account'));}}catch(e){console.warn('Identitas akun belum dapat dimuat.');}
