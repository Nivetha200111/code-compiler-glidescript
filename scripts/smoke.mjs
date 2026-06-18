// Headless smoke test: runs representative GlideScript snippets through the
// engine and prints the captured output. Proves the core works without a UI.
import { runScript, resetDatabase } from '../src/engine/runtime.js'

const cases = [
  {
    name: 'gs.info + substitution',
    code: `gs.info('Hello {0} from {1}', 'world', gs.getUserName());`,
  },
  {
    name: 'GlideRecord query loop',
    code: `var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.addQuery('priority', '<=', 2);
gr.orderBy('priority');
gr.query();
gs.info('rows=' + gr.getRowCount());
while (gr.next()) { gs.info(gr.number + ' P' + gr.priority + ' ' + gr.short_description); }`,
  },
  {
    name: 'display values (choice + reference)',
    code: `var gr = new GlideRecord('incident');
gr.get('number','INC0010001');
gs.info('state ' + gr.getValue('state') + ' -> ' + gr.getDisplayValue('state'));
gs.info('caller -> ' + gr.getDisplayValue('caller_id'));`,
  },
  {
    name: 'encoded query with OR',
    code: `var gr = new GlideRecord('incident');
gr.addEncodedQuery('active=true^priority=1^ORpriority=2');
gr.query();
gs.info('matched=' + gr.getRowCount());`,
  },
  {
    name: 'insert + read back',
    code: `var gr = new GlideRecord('incident');
gr.initialize();
gr.setValue('short_description','from smoke test');
gr.setValue('priority',3);
var id = gr.insert();
var c = new GlideRecord('incident');
c.get(id);
gs.info('created ' + c.number + ' / ' + c.short_description);`,
  },
  {
    name: 'GlideAggregate COUNT group by priority',
    code: `var ga = new GlideAggregate('incident');
ga.addQuery('active', true);
ga.addAggregate('COUNT');
ga.groupBy('priority');
ga.query();
while (ga.next()) { gs.info('P' + ga.getValue('priority') + ' = ' + ga.getAggregate('COUNT')); }`,
  },
  {
    name: 'GlideDateTime arithmetic',
    code: `var a = new GlideDateTime();
var b = new GlideDateTime();
b.addDays(7);
gs.info('before? ' + a.before(b));`,
  },
  {
    name: 'runtime error is caught',
    code: `var gr = new GlideRecord('incident'); gr.query(); gr.nonexistentMethod();`,
  },
]

let failures = 0
for (const c of cases) {
  resetDatabase()
  const { output, error } = runScript(c.code)
  console.log(`\n=== ${c.name} ===`)
  for (const e of output) console.log(`  [${e.level}] ${e.text}`)
  if (c.name.includes('error is caught')) {
    if (!error) {
      console.log('  !! expected an error but none was thrown')
      failures++
    }
  } else if (error) {
    console.log('  !! unexpected error: ' + error.message)
    failures++
  }
}

console.log(`\n${failures === 0 ? 'ALL OK' : failures + ' FAILURE(S)'}`)
process.exit(failures === 0 ? 0 : 1)
