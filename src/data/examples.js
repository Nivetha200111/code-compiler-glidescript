// A curated library of runnable GlideScript examples, grouped by concept.

export const EXAMPLES = [
  {
    group: 'Getting started',
    items: [
      {
        id: 'hello',
        title: 'Hello, GlideScript',
        desc: 'Logging and string substitution with gs.info',
        code: `// gs is the GlideSystem object — your main logging tool.
gs.info('Hello from GlideScript!');

// {0}, {1}... are replaced by the extra arguments.
var name = 'Abel';
gs.info('Logged in as {0} ({1})', name, gs.getUserName());

gs.print('gs.print works too');
gs.warn('This is a warning');
gs.error('This is an error');
`,
      },
      {
        id: 'vars',
        title: 'Plain JavaScript',
        desc: 'GlideScript is JavaScript — loops, arrays, JSON all work',
        code: `var fruits = ['apple', 'banana', 'cherry'];

for (var i = 0; i < fruits.length; i++) {
  gs.info('{0}: {1}', i, fruits[i]);
}

var payload = { ok: true, items: fruits.length };
gs.info('JSON: ' + JSON.stringify(payload));
`,
      },
    ],
  },
  {
    group: 'GlideRecord — reading',
    items: [
      {
        id: 'gr-basic',
        title: 'Query records',
        desc: 'The classic query / next() loop',
        code: `// Find all active, high-priority incidents.
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.addQuery('priority', '<=', 2);
gr.orderBy('priority');
gr.query();

gs.info('Found {0} matching incidents:', gr.getRowCount());
while (gr.next()) {
  gs.info('{0}  P{1}  {2}', gr.number, gr.priority, gr.short_description);
}
`,
      },
      {
        id: 'gr-get',
        title: 'get() a single record',
        desc: 'Look up one record and read its fields',
        code: `var gr = new GlideRecord('incident');
if (gr.get('number', 'INC0010001')) {
  gs.info('Short description: ' + gr.short_description);
  gs.info('Priority value:   ' + gr.getValue('priority'));
  gs.info('Priority label:   ' + gr.getDisplayValue('priority'));
  gs.info('Assigned to:      ' + gr.getDisplayValue('assigned_to'));
} else {
  gs.error('Incident not found');
}
`,
      },
      {
        id: 'gr-display',
        title: 'Values vs. display values',
        desc: 'Reference fields and choice labels',
        code: `var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.setLimit(3);
gr.query();

while (gr.next()) {
  gs.info('--- ' + gr.number + ' ---');
  gs.info('  state:    ' + gr.getValue('state') + ' -> ' + gr.getDisplayValue('state'));
  gs.info('  caller:   ' + gr.getDisplayValue('caller_id'));
  gs.info('  group:    ' + gr.getDisplayValue('assignment_group'));
}
`,
      },
      {
        id: 'gr-encoded',
        title: 'Encoded query',
        desc: 'addEncodedQuery with ^ (AND) and ^OR',
        code: `var gr = new GlideRecord('incident');
// active = true AND (priority = 1 OR priority = 2)
gr.addEncodedQuery('active=true^priority=1^ORpriority=2');
gr.orderByDesc('priority');
gr.query();

while (gr.next()) {
  gs.info('{0}  priority {1}  {2}', gr.number, gr.priority, gr.short_description);
}
`,
      },
    ],
  },
  {
    group: 'GlideRecord — writing',
    items: [
      {
        id: 'gr-insert',
        title: 'Insert a record',
        desc: 'initialize() + setValue() + insert() — auto-numbered',
        code: `var gr = new GlideRecord('incident');
gr.initialize();
gr.setValue('short_description', 'New laptop request from script');
gr.setValue('priority', 3);
gr.setValue('category', 'hardware');
var sysId = gr.insert();

gs.info('Created incident with sys_id ' + sysId);

// Read it back
var check = new GlideRecord('incident');
check.get(sysId);
gs.info('Number assigned: ' + check.number);
`,
      },
      {
        id: 'gr-update',
        title: 'Update matching records',
        desc: 'Bulk-edit in a query loop',
        code: `var gr = new GlideRecord('incident');
gr.addQuery('assignment_group.name', 'Hardware'); // dot-walk not resolved here; use group sys_id in real ServiceNow
gr.addQuery('priority', 3);
gr.query();

var count = 0;
while (gr.next()) {
  gr.setValue('priority', 2); // escalate
  gr.update();
  count++;
}
gs.info('Escalated {0} incident(s) to priority 2', count);
`,
      },
    ],
  },
  {
    group: 'Aggregates & reporting',
    items: [
      {
        id: 'agg-count',
        title: 'Count by group',
        desc: 'GlideAggregate COUNT grouped by priority',
        code: `var ga = new GlideAggregate('incident');
ga.addQuery('active', true);
ga.addAggregate('COUNT');
ga.groupBy('priority');
ga.query();

gs.info('Active incidents by priority:');
while (ga.next()) {
  var p = ga.getValue('priority');
  var c = ga.getAggregate('COUNT');
  gs.info('  Priority ' + p + ': ' + c);
}
`,
      },
      {
        id: 'agg-total',
        title: 'Grand total',
        desc: 'A single COUNT over the whole table',
        code: `var ga = new GlideAggregate('incident');
ga.addAggregate('COUNT');
ga.query();
ga.next();
gs.info('Total incidents in table: ' + ga.getAggregate('COUNT'));
`,
      },
    ],
  },
  {
    group: 'Dates & utilities',
    items: [
      {
        id: 'dates',
        title: 'GlideDateTime',
        desc: 'Now, arithmetic, comparisons',
        code: `var now = new GlideDateTime();
gs.info('Now: ' + now.getValue());

var later = new GlideDateTime();
later.addDays(7);
gs.info('In a week: ' + later.getValue());

gs.info('now before later? ' + now.before(later));
gs.info('gs.nowDateTime(): ' + gs.nowDateTime());
gs.info('gs.daysAgo(30):   ' + gs.daysAgo(30));
`,
      },
      {
        id: 'guid',
        title: 'GUIDs & properties',
        desc: 'Handy gs helpers',
        code: `gs.info('New GUID:   ' + gs.generateGUID());
gs.info('User:       ' + gs.getUserDisplayName());
gs.info('Instance:   ' + gs.getProperty('instance_name'));
gs.info('Product:    ' + gs.getProperty('glide.product.name', 'fallback'));
`,
      },
    ],
  },
]

export const DEFAULT_CODE = EXAMPLES[1].items[0].code

export const DEFAULT_CLIENT_CODE = `function onLoad() {
  g_form.addInfoMessage('Client form loaded for ' + g_form.getTableName());
  g_form.setMandatory('short_description', true);
}

function onChange(control, oldValue, newValue, isLoading) {
  if (isLoading) return;

  if (newValue === '1') {
    g_form.addErrorMessage('Priority 1 requires an assignment group.');
    g_form.setMandatory('assignment_group', true);
  } else {
    g_form.setMandatory('assignment_group', false);
  }
}

function onSubmit() {
  if (!g_form.getValue('short_description')) {
    g_form.addErrorMessage('Short description is required.');
    return false;
  }
  g_form.addInfoMessage('Form is ready to submit.');
  return true;
}
`

export const DEFAULT_PRODUCER_CODE = `// Record Producer script.
// "producer" contains catalog variables; "current" is the target record.
current.short_description = producer.short_description;
current.category = producer.category;
current.priority = producer.urgency;
current.active = 'true';

gs.info('Producer mapped request for ' + producer.requested_for);
`
