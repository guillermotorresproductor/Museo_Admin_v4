const test=require('node:test');
const assert=require('node:assert/strict');
function minutes(a,b,lunch){
 const t=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
 const span=(t(b)-t(a)+1440)%1440;
 if(!span||lunch<0||lunch>=span)throw Error('invalid');
 return span-lunch;
}
test('jornada tarde 8 horas',()=>assert.equal(minutes('13:00','22:00',60),480));
test('jornada tarde 7 horas',()=>assert.equal(minutes('13:00','21:00',60),420));
test('turno nocturno 8 horas',()=>assert.equal(minutes('22:00','07:00',60),480));
test('jornada excesiva',()=>assert.ok(minutes('08:00','18:00',60)>480));
test('almuerzo inválido',()=>assert.throws(()=>minutes('08:00','09:00',60)));
test('semana 40 horas',()=>assert.equal(5*minutes('13:00','22:00',60),2400));
test('semana excesiva',()=>assert.ok(6*minutes('13:00','22:00',60)>2400));
