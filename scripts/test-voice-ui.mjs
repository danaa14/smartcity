import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true});
const mockVoice = async (page) => {
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
};
try {
  const page = await browser.newPage();
  await mockVoice(page);
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

  // Reported on the live site: room noise heard during the greeting came back late as the
  // transcription hint ("Вопросы о муниципальных услугах… AGSV, Apă-Canal, EXDRUPO…"), was shown
  // as the caller's words, answered on top of the greeting, and the resulting provider error
  // ended the call. Switching language afterwards left the old call's text on screen.
  const call = await browser.newPage();
  await mockVoice(call);
  await call.goto(process.env.BASE || 'http://localhost:3127');
  await call.getByRole('button',{name:'Sună',exact:true}).click();
  await call.getByRole('button',{name:'Pornește asistentul vocal',exact:true}).click();
  await call.waitForFunction(()=>window.voiceTest.sent.length>0);
  const cemit = event=>call.evaluate(e=>window.voiceTest.emit(e),event);
  const creates = ()=>call.evaluate(()=>window.voiceTest.sent.filter(e=>e.type==='response.create').length);
  const userLines = ()=>call.locator('.voice-call-transcript').getByText('Tu',{exact:true}).count();
  const alert = ()=>call.locator('.voice-call').innerText();
  await cemit({type:'response.created'});
  await cemit({type:'output_audio_buffer.started'});
  await cemit({type:'response.output_audio_transcript.delta',delta:'Bună ziua, aici pe fir. Cu ce vă pot ajuta?'});
  await cemit({type:'conversation.item.input_audio_transcription.completed',transcript:'Cum depun o petiție?'});
  assert.equal(await creates(),1,'a transcript arriving during the greeting must not start a second response');
  assert.equal(await userLines(),0,'a transcript arriving during the greeting is not shown as the caller');
  await cemit({type:'error',error:{code:'conversation_already_has_active_response'}});
  assert.doesNotMatch(await call.locator('.voice-call-status').textContent(),/Eroare|Apel încheiat/,'an overlapping response.create must not end the call');
  await cemit({type:'response.done',response:{status:'completed',output:[]}});
  await cemit({type:'output_audio_buffer.stopped'});
  assert.equal(await call.evaluate(()=>window.voiceTest.track.enabled),true,'call keeps listening after the greeting');
  for (const echo of [
    'Întrebări despre servicii municipale în Chișinău. Păstrează exact numele străzilor și instituțiilor (Pretura, AGSV, Apă-Canal, EXDRUPO), datele, sumele și numerele documentelor.',
    'Вопросы о муниципальных услугах Кишинёва. Точно сохраняй названия улиц и учреждений (Претура, AGSV, Apă-Canal, EXDRUPO), даты, суммы и номера документов.',
  ]) {
    await cemit({type:'input_audio_buffer.speech_stopped'});
    await cemit({type:'conversation.item.input_audio_transcription.completed',transcript:echo});
    assert.equal(await creates(),1,'the transcription hint echoed back is not answered');
    assert.equal(await userLines(),0,'the transcription hint echoed back is not shown as the caller');
    assert.equal(await call.evaluate(()=>window.voiceTest.track.enabled),true,'after a hint echo the microphone listens again');
  }
  assert.doesNotMatch(await alert(),/Вопросы|Întrebări despre servicii/);
  await cemit({type:'conversation.item.input_audio_transcription.completed',transcript:'Cum depun o petiție?'});
  assert.equal(await creates(),2,'a real question after the greeting is answered');
  assert.equal(await userLines(),1);
  await cemit({type:'error',error:{code:'session_expired'}});
  assert.match(await alert(),/nu este disponibil/i,'a real provider error is still reported');
  await call.keyboard.press('Escape');
  await call.getByRole('button',{name:'Deschide meniul'}).click();
  await call.getByRole('button',{name:'Русский'}).click();
  await call.keyboard.press('Escape');
  await call.getByRole('button',{name:/Позвонить|Звонок/}).first().click();
  await call.waitForSelector('text=Начать голосовой разговор');
  const after = await alert();
  assert.doesNotMatch(after,/Bună ziua|Cum depun|nu este disponibil/,'switching language clears the previous call: '+after.slice(0,200));
  console.log('Voice UI regressions passed: playback, empty/failed transcript, contextual search, pending tools, cleanup, late/echoed transcripts, overlapping response, language switch. WebRTC/provider mocked; no microphone or paid API used.');
} finally { await browser.close(); }
