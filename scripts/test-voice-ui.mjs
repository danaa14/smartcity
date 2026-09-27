import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const track = { enabled:true, stop(){ this.stopped = true; } };
    window.voiceTest = { track, sent:[] };
    Object.defineProperty(navigator, 'mediaDevices', {value:{getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})}});
    window.RTCPeerConnection = class {
      connectionState = 'connected';
      addTrack() {}
      createDataChannel() {
        const channel = {readyState:'open',send:(text)=>window.voiceTest.sent.push(JSON.parse(text)),close(){this.readyState='closed';}};
        window.voiceTest.channel = channel;
        return channel;
      }
      async createOffer() { return {type:'offer',sdp:'test'}; }
      async setLocalDescription() {}
      async setRemoteDescription() { window.voiceTest.channel.onopen(); }
      close() { this.connectionState = 'closed'; }
    };
    window.voiceTest.emit = (event) => window.voiceTest.channel.onmessage({data:JSON.stringify(event)});
  });
  await page.route('**/api/voice/ready',r=>r.fulfill({json:{ready:true}}));
  await page.route('**/api/voice/token',r=>r.fulfill({json:{value:'mock-ephemeral'}}));
  await page.route('https://api.openai.com/v1/realtime/calls',r=>r.fulfill({body:'mock-sdp'}));
  const queries = [];
  let pendingSearch;
  await page.route('**/api/voice/search',async r=>{
    queries.push(r.request().postDataJSON().query);
    if (queries.length === 1) await new Promise(resolve=>{pendingSearch=resolve;});
    await r.fulfill({json:{results:[],fallback:'Nu pot confirma.',missingParts:[],nextSteps:[]}}).catch(()=>{});
  });
  await page.goto(process.env.BASE || 'http://localhost:3127');
  await page.getByRole('button',{name:'Sună',exact:true}).click();
  await page.getByRole('button',{name:'Pornește asistentul vocal',exact:true}).click();
  await page.waitForFunction(()=>window.voiceTest.sent.length>0);
  assert.equal(await page.evaluate(()=>window.voiceTest.track.enabled),false,'greeting request must pause microphone before server acknowledgement');
  const emit = event=>page.evaluate(e=>window.voiceTest.emit(e),event);
  const mic = ()=>page.evaluate(()=>window.voiceTest.track.enabled);
  await emit({type:'response.created'});
  await emit({type:'output_audio_buffer.started'});
  await emit({type:'response.done',response:{status:'completed',output:[]}});
  assert.equal(await mic(),false,'generation complete must not enable microphone while playback continues');
  await emit({type:'output_audio_buffer.stopped'});
  assert.equal(await mic(),true);
  // Stop during playback must wait for BOTH server acknowledgements.
  await emit({type:'response.created'});
  await emit({type:'output_audio_buffer.started'});
  await page.getByRole('button',{name:'Oprește răspunsul',exact:true}).click();
  assert.equal(await mic(),false,'interrupt must not open microphone before cancellation');
  await emit({type:'output_audio_buffer.cleared'});
  assert.equal(await mic(),false,'cleared audio alone does not finish generation');
  await emit({type:'conversation.item.input_audio_transcription.failed'});
  assert.equal(await mic(),false,'late transcription failure must not reopen microphone during generation');
  await emit({type:'response.done',response:{status:'cancelled',output:[]}});
  assert.equal(await mic(),true);
  await emit({type:'input_audio_buffer.speech_stopped'});
  await emit({type:'conversation.item.input_audio_transcription.completed',transcript:''});
  assert.equal(await mic(),true,'empty transcript should recover listening');
  await emit({type:'input_audio_buffer.speech_stopped'});
  await emit({type:'conversation.item.input_audio_transcription.failed'});
  assert.equal(await mic(),true,'failed transcription should recover listening');
  await emit({type:'conversation.item.input_audio_transcription.completed',transcript:'Și cât costă?'});
  await emit({type:'response.created'});
  await emit({type:'response.function_call_arguments.done',name:'searchMunicipalDocuments',call_id:'call-1',arguments:JSON.stringify({query:'Cât costă contractul de apă?'})});
  await page.waitForFunction(()=>document.querySelector('.voice-call-status').textContent.includes('Verific'));
  await emit({type:'response.done',response:{status:'completed',output:[{type:'function_call'}]}});
  assert.equal(await mic(),false,'tool phase must not reopen microphone');
  await page.waitForTimeout(50);
  assert.equal(queries[0],'Cât costă contractul de apă?','standalone query must survive the raw transcript');
  const sentBeforeEnd = await page.evaluate(()=>window.voiceTest.sent.length);
  await page.getByRole('button',{name:'Încheie apelul',exact:true}).click();
  pendingSearch();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.voiceTest.sent.length),sentBeforeEnd,'closed calls must not send late tool output');
  assert.equal(await page.evaluate(()=>window.voiceTest.track.stopped),true);
  assert.match(await page.locator('.voice-call-status').textContent(),/Apel încheiat/);
  console.log('Voice UI regressions passed: playback, empty/failed transcript, contextual search, pending tools, cleanup. WebRTC/provider mocked; no microphone or paid API used.');
} finally { await browser.close(); }
