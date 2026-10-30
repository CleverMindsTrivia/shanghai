import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import * as E from '../public/engine.mjs';
function harness(){
 const element={addEventListener(){}};
 const context=vm.createContext({E,document:{querySelector:()=>element,addEventListener(){}},localStorage:{setItem(){}},crypto:{randomUUID:()=> 'same-request'},setTimeout(){},AbortSignal});
 const source=fs.readFileSync(new URL('../public/multiplayer.mjs',import.meta.url),'utf8').replace("import * as E from './engine.mjs';",'').replace(/boot\(\);\s*$/,'');
 vm.runInContext(source+`\nrender=()=>{};notify=()=>{};session={code:'ABCDEFGH',token:'test'};state={code:'ABCDEFGH',version:5,you:0,hand:[{id:'a',rank:8,suit:'clubs'},{id:'b',rank:2,suit:'hearts'}],game:{round:0,turn:0,phase:'play',roundOver:false,players:[{down:false}]}};`,context);
 return code=>vm.runInContext(code,context);
}
test('multiplayer sorting supports rank and suit without changing selected cards',()=>{
 const run=harness();run("selected.add('a');sortMode='rank';sortHand()");assert.equal(run('order.join()'),'b,a');assert.equal(run("selected.has('a')"),true);
 run("sortMode='suit';sortHand()");assert.equal(run('order.join()'),[...run('state.hand')].sort((a,b)=>E.SUITS.indexOf(a.suit)-E.SUITS.indexOf(b.suit)).map(c=>c.id).join());
});
test('a delayed poll cannot overwrite a newer move response',()=>{const run=harness();run('accept({...state,version:4,hand:[]})');assert.equal(run('state.version'),5);assert.equal(run('state.hand.length'),2);});
test('discard retries a version conflict once with the same move ID',async()=>{
 const run=harness();run(`let attempts=[];api=async input=>{if(input.op==='view')return {...state,version:6};attempts.push(input);if(attempts.length===1)throw Object.assign(Error('Conflict'),{status:409});return {...state,version:7,hand:[]};};`);
 assert.equal(await run("move('discard',{card:'a'})"),true);assert.equal(run('attempts.length'),2);assert.equal(run('attempts[1].version'),6);assert.equal(run('attempts[0].requestId===attempts[1].requestId'),true);
});
test('a discard conflict does not retry after the turn changes',async()=>{
 const run=harness();run(`let attempts=0;api=async input=>{if(input.op==='view')return {...state,version:6,game:{...state.game,turn:1}};attempts++;throw Object.assign(Error('Conflict'),{status:409});};`);
 assert.equal(await run("move('discard',{card:'a'})"),false);assert.equal(run('attempts'),1);
});
