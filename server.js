const express = require('express');
const session = require('express-session');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const CRM_PASSWORD = process.env.CRM_PASSWORD || 'ccm2024';
const API_KEY = process.env.API_KEY || 'ccm-agent-key-2024';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'crm.db');

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    hq_state TEXT, hq_city TEXT,
    agent_count_min INTEGER, agent_count_max INTEGER,
    website TEXT, phone TEXT, email TEXT,
    type TEXT, status TEXT DEFAULT 'new', priority TEXT DEFAULT 'medium',
    notes TEXT, source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    first_name TEXT, last_name TEXT, title TEXT,
    email TEXT, phone TEXT, linkedin TEXT,
    is_primary INTEGER DEFAULT 0, notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    type TEXT NOT NULL, subject TEXT, notes TEXT,
    outcome TEXT, follow_up_date TEXT, completed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS demo_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    organization TEXT,
    ai_currently TEXT,
    ai_use_case TEXT,
    need TEXT,
    source TEXT DEFAULT 'landing',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
  CREATE INDEX IF NOT EXISTS idx_activities_follow_up ON activities(follow_up_date);
  CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
  CREATE INDEX IF NOT EXISTS idx_demo_requests_created ON demo_requests(created_at);
  CREATE TRIGGER IF NOT EXISTS companies_updated AFTER UPDATE ON companies
    BEGIN UPDATE companies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
`);

for (const column of [
  ['ai_currently', 'TEXT'],
  ['ai_use_case', 'TEXT'],
]) {
  try { db.prepare(`ALTER TABLE demo_requests ADD COLUMN ${column[0]} ${column[1]}`).run(); } catch (_) {}
}

// Seed on first run
const count = db.prepare('SELECT COUNT(*) as n FROM companies').get().n;
if (count === 0) {
  const ins = db.prepare(`INSERT INTO companies (name,hq_state,hq_city,agent_count_min,agent_count_max,website,phone,type,priority,source,notes,email)
    VALUES (@name,@hq_state,@hq_city,@agent_count_min,@agent_count_max,@website,@phone,@type,@priority,@source,@notes,@email)`);
  const seed = db.transaction(rows => { for (const r of rows) ins.run({email:'',notes:'',phone:'',website:'',...r}); });
  seed([
    {name:'GoHealth',hq_state:'IL',hq_city:'Chicago',agent_count_min:3000,agent_count_max:5000,website:'gohealth.com',phone:'1-800-979-0109',type:'Public FMO/Agency',priority:'high',source:'research'},
    {name:'eHealth Inc.',hq_state:'CA',hq_city:'Santa Clara',agent_count_min:3000,agent_count_max:4000,website:'ehealthinsurance.com',phone:'1-800-977-8860',type:'Public Marketplace',priority:'high',source:'research'},
    {name:'SelectQuote',hq_state:'KS',hq_city:'Overland Park',agent_count_min:2000,agent_count_max:3500,website:'selectquote.com',phone:'1-800-777-8353',type:'Public FMO/Agency',priority:'high',source:'research'},
    {name:'HealthMarkets',hq_state:'TX',hq_city:'North Richland Hills',agent_count_min:2500,agent_count_max:3500,website:'healthmarkets.com',phone:'1-800-304-3414',type:'IMO',priority:'high',source:'research'},
    {name:'Integrity Marketing Group',hq_state:'TX',hq_city:'Dallas',agent_count_min:5000,agent_count_max:10000,website:'integritymarketing.com',phone:'214-389-2100',type:'FMO/Holding Company',priority:'high',source:'research'},
    {name:'AmeriLife Holdings',hq_state:'FL',hq_city:'Clearwater',agent_count_min:5000,agent_count_max:10000,website:'amerilife.com',phone:'727-726-5553',type:'FMO/Holding Company',priority:'high',source:'research'},
    {name:'Assurance IQ (Prudential)',hq_state:'WA',hq_city:'Bellevue',agent_count_min:2500,agent_count_max:4000,website:'assurance.com',type:'FMO/Agency',priority:'high',source:'research'},
    {name:'e-TeleQuote (Globe Life)',hq_state:'FL',hq_city:'Clearwater',agent_count_min:600,agent_count_max:1200,website:'etelemarketing.com',phone:'727-828-9910',type:'Captive Agency',priority:'high',source:'research'},
    {name:'HealthPlanOne (HPOne)',hq_state:'CT',hq_city:'Shelton',agent_count_min:500,agent_count_max:1500,website:'healthplanone.com',phone:'203-925-1000',type:'FMO/Agency',priority:'high',source:'research'},
    {name:'Senior Market Sales',hq_state:'NE',hq_city:'Omaha',agent_count_min:400,agent_count_max:800,website:'seniormarketsales.com',phone:'1-888-456-7987',type:'FMO',priority:'medium',source:'research'},
    {name:'Ritter Insurance Marketing',hq_state:'PA',hq_city:'Harrisburg',agent_count_min:300,agent_count_max:700,website:'ritterim.com',phone:'1-800-769-1847',type:'FMO',priority:'medium',source:'research'},
    {name:'Precision Senior Marketing',hq_state:'MO',hq_city:'',agent_count_min:100,agent_count_max:400,website:'psmmarketing.com',phone:'1-800-701-0689',type:'FMO',priority:'medium',source:'research'},
    {name:'TrueCoverage / Insx Hub',hq_state:'NM',hq_city:'Albuquerque',agent_count_min:200,agent_count_max:800,website:'truecoverage.com',phone:'1-888-855-6837',type:'FMO/Agency',priority:'medium',source:'research'},
    {name:'PolicyGenius (Zinnia)',hq_state:'NY',hq_city:'New York',agent_count_min:200,agent_count_max:500,website:'policygenius.com',phone:'1-855-695-2255',type:'Online Marketplace',priority:'medium',source:'research'},
    {name:'Chapter Medicare',hq_state:'NY',hq_city:'New York',agent_count_min:50,agent_count_max:200,website:'joincchapter.com',phone:'1-855-900-2427',type:'Tech-Enabled Agency',priority:'medium',source:'research'},
    {name:'Boomer Benefits',hq_state:'TX',hq_city:'Fort Worth',agent_count_min:100,agent_count_max:300,website:'boomerbenefits.com',phone:'1-855-732-9055',type:'Independent Agency',priority:'medium',source:'research'},
    {name:'Acentria Insurance',hq_state:'FL',hq_city:'Fort Lauderdale',agent_count_min:200,agent_count_max:600,website:'acentria.com',phone:'954-958-1200',type:'Independent Agency',priority:'medium',source:'research'},
    {name:'Insurance Care Direct',hq_state:'FL',hq_city:'',agent_count_min:100,agent_count_max:400,website:'insurancecaredirect.com',type:'Independent Agency',priority:'medium',source:'research'},
    {name:'American Exchange',hq_state:'CO',hq_city:'',agent_count_min:100,agent_count_max:300,website:'americanexchange.com',type:'IMO/FMO',priority:'medium',source:'research'},
    {name:'Senior Benefit Services',hq_state:'IN',hq_city:'',agent_count_min:100,agent_count_max:400,website:'seniorbenefitservices.net',type:'IMO/FMO',priority:'medium',source:'research'},
    {name:'Renaissance Life & Health',hq_state:'IN',hq_city:'Indianapolis',agent_count_min:200,agent_count_max:600,website:'renaissancelife.com',phone:'1-877-355-5433',type:'Carrier/Captive Agency',priority:'medium',source:'research'},
    {name:'Retiree First',hq_state:'OH',hq_city:'',agent_count_min:50,agent_count_max:200,website:'retireefirst.com',type:'Independent Agency',priority:'low',source:'research'},
    {name:'MedSupUSA',hq_state:'',hq_city:'',agent_count_min:50,agent_count_max:200,website:'medsupusa.com',type:'Independent Agency',priority:'low',source:'research'},
    {name:'AgileHealthInsurance / HNO',hq_state:'FL',hq_city:'',agent_count_min:50,agent_count_max:500,type:'FMO/Agency Network',priority:'medium',source:'research'},
    {name:'HHMG',hq_state:'',hq_city:'',agent_count_min:100,agent_count_max:500,type:'FMO',priority:'medium',source:'research'},
  ]);
  console.log('Seeded 25 companies.');
}

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'ccm-crm-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
}));

// Public — CCM marketing site
app.use(express.static(path.join(__dirname)));

app.post('/api/demo-request', (req, res) => {
  const { name, email, phone, organization, ai_currently, ai_use_case, need } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const result = db.prepare(`
    INSERT INTO demo_requests (name, email, phone, organization, ai_currently, ai_use_case, need)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name.trim(), email.trim(), phone || '', organization || '', ai_currently || '', ai_use_case || '', need || '');
  res.json({ ok: true, id: result.lastInsertRowid });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
app.get('/crm/login', (req, res) => {
  const err = req.query.error ? '<p class="err">Incorrect password. Try again.</p>' : '';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CCM — CRM Login</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',sans-serif;background:#0b0f1e;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#e2e8f0}
  .card{background:#1a1d27;border:1px solid #2e3347;border-radius:14px;padding:40px;width:360px}
  .logo{font-size:1.1rem;font-weight:700;color:#FF6B1A;margin-bottom:6px}
  h1{font-size:1.3rem;margin-bottom:24px;color:#e2e8f0}
  label{font-size:.78rem;color:#94a3b8;display:block;margin-bottom:4px}
  input[type=password]{width:100%;padding:10px 12px;background:#232636;border:1px solid #2e3347;border-radius:6px;color:#e2e8f0;font-size:.9rem;outline:none;margin-bottom:16px}
  input[type=password]:focus{border-color:#3b82f6}
  button{width:100%;padding:11px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:.9rem;font-weight:600;cursor:pointer}
  button:hover{background:#1d4ed8}
  .err{color:#f87171;font-size:.82rem;margin-bottom:14px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Complete Care Marketing</div>
  <h1>CRM Access</h1>
  ${err}
  <form method="POST" action="/crm/login">
    <label>Password</label>
    <input type="password" name="password" autofocus placeholder="Enter password">
    <button type="submit">Sign In</button>
  </form>
</div>
</body>
</html>`);
});

app.post('/crm/login', (req, res) => {
  if (req.body.password === CRM_PASSWORD) {
    req.session.crmAuth = true;
    const returnTo = req.session.returnTo || '/crm';
    delete req.session.returnTo;
    res.redirect(returnTo);
  } else {
    res.redirect('/crm/login?error=1');
  }
});

app.get('/crm/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/crm/login');
});

// Auth guard — accepts browser session OR X-API-Key header
function requireAuth(req, res, next) {
  if (req.session.crmAuth) return next();
  if (req.headers['x-api-key'] === API_KEY) return next();
  if (req.path.startsWith('/crm/api/')) return res.status(401).json({ error: 'Unauthorized' });
  req.session.returnTo = req.originalUrl;
  res.redirect('/crm/login');
}

// ── CRM API ───────────────────────────────────────────────────────────────────
app.get('/crm/api/stats', requireAuth, (req, res) => {
  res.json({
    total_companies: db.prepare('SELECT COUNT(*) as n FROM companies').get().n,
    by_status: db.prepare('SELECT status, COUNT(*) as n FROM companies GROUP BY status').all(),
    by_priority: db.prepare('SELECT priority, COUNT(*) as n FROM companies GROUP BY priority').all(),
    total_contacts: db.prepare('SELECT COUNT(*) as n FROM contacts').get().n,
    open_activities: db.prepare('SELECT COUNT(*) as n FROM activities WHERE completed = 0').get().n,
    upcoming_followups: db.prepare("SELECT COUNT(*) as n FROM activities WHERE completed=0 AND follow_up_date IS NOT NULL AND follow_up_date <= date('now','+7 days')").get().n,
  });
});

app.get('/crm/api/companies', requireAuth, (req, res) => {
  const { search, status, priority, state, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const cond = []; const p = [];
  if (search) { cond.push('(c.name LIKE ? OR c.hq_city LIKE ? OR c.website LIKE ?)'); p.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  if (status) { cond.push('c.status=?'); p.push(status); }
  if (priority) { cond.push('c.priority=?'); p.push(priority); }
  if (state) { cond.push('c.hq_state=?'); p.push(state); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as count FROM companies c ${where}`).get(...p).count;
  const rows = db.prepare(`SELECT c.*,(SELECT COUNT(*) FROM contacts WHERE company_id=c.id) AS contact_count,(SELECT COUNT(*) FROM activities WHERE company_id=c.id AND completed=0) AS open_activities,(SELECT MAX(created_at) FROM activities WHERE company_id=c.id) AS last_activity FROM companies c ${where} ORDER BY c.priority DESC,c.name ASC LIMIT ? OFFSET ?`).all(...p, Number(limit), Number(offset));
  res.json({ total, page: Number(page), limit: Number(limit), data: rows });
});

app.get('/crm/api/companies/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM companies WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  c.contacts = db.prepare('SELECT * FROM contacts WHERE company_id=? ORDER BY is_primary DESC,last_name').all(req.params.id);
  c.activities = db.prepare('SELECT a.*,c.first_name,c.last_name FROM activities a LEFT JOIN contacts c ON a.contact_id=c.id WHERE a.company_id=? ORDER BY a.created_at DESC').all(req.params.id);
  res.json(c);
});

app.post('/crm/api/companies', requireAuth, (req, res) => {
  const { name, hq_state, hq_city, agent_count_min, agent_count_max, website, phone, email, type, status, priority, notes, source } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare(`INSERT INTO companies (name,hq_state,hq_city,agent_count_min,agent_count_max,website,phone,email,type,status,priority,notes,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(name,hq_state,hq_city,agent_count_min,agent_count_max,website,phone,email,type,status||'new',priority||'medium',notes,source);
  res.json({ id: r.lastInsertRowid });
});

app.put('/crm/api/companies/:id', requireAuth, (req, res) => {
  const { name, hq_state, hq_city, agent_count_min, agent_count_max, website, phone, email, type, status, priority, notes } = req.body;
  db.prepare(`UPDATE companies SET name=?,hq_state=?,hq_city=?,agent_count_min=?,agent_count_max=?,website=?,phone=?,email=?,type=?,status=?,priority=?,notes=? WHERE id=?`).run(name,hq_state,hq_city,agent_count_min,agent_count_max,website,phone,email,type,status,priority,notes,req.params.id);
  res.json({ ok: true });
});

app.delete('/crm/api/companies/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM companies WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/crm/api/contacts', requireAuth, (req, res) => {
  const { company_id } = req.query;
  const rows = company_id
    ? db.prepare('SELECT * FROM contacts WHERE company_id=? ORDER BY is_primary DESC,last_name').all(company_id)
    : db.prepare('SELECT co.*,c.name AS company_name FROM contacts co LEFT JOIN companies c ON co.company_id=c.id ORDER BY co.last_name').all();
  res.json(rows);
});

app.post('/crm/api/contacts', requireAuth, (req, res) => {
  const { company_id, first_name, last_name, title, email, phone, linkedin, is_primary, notes } = req.body;
  const r = db.prepare(`INSERT INTO contacts (company_id,first_name,last_name,title,email,phone,linkedin,is_primary,notes) VALUES (?,?,?,?,?,?,?,?,?)`).run(company_id,first_name,last_name,title,email,phone,linkedin,is_primary?1:0,notes);
  res.json({ id: r.lastInsertRowid });
});

app.put('/crm/api/contacts/:id', requireAuth, (req, res) => {
  const { first_name, last_name, title, email, phone, linkedin, is_primary, notes } = req.body;
  db.prepare(`UPDATE contacts SET first_name=?,last_name=?,title=?,email=?,phone=?,linkedin=?,is_primary=?,notes=? WHERE id=?`).run(first_name,last_name,title,email,phone,linkedin,is_primary?1:0,notes,req.params.id);
  res.json({ ok: true });
});

app.delete('/crm/api/contacts/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/crm/api/activities', requireAuth, (req, res) => {
  const { company_id, upcoming } = req.query;
  if (upcoming) {
    return res.json(db.prepare(`SELECT a.*,c.name AS company_name,co.first_name,co.last_name FROM activities a LEFT JOIN companies c ON a.company_id=c.id LEFT JOIN contacts co ON a.contact_id=co.id WHERE a.completed=0 AND a.follow_up_date IS NOT NULL AND a.follow_up_date!='' ORDER BY a.follow_up_date ASC LIMIT 50`).all());
  }
  const rows = company_id
    ? db.prepare(`SELECT a.*,co.first_name,co.last_name FROM activities a LEFT JOIN contacts co ON a.contact_id=co.id WHERE a.company_id=? ORDER BY a.created_at DESC`).all(company_id)
    : db.prepare(`SELECT a.*,c.name AS company_name,co.first_name,co.last_name FROM activities a LEFT JOIN companies c ON a.company_id=c.id LEFT JOIN contacts co ON a.contact_id=co.id ORDER BY a.created_at DESC LIMIT 100`).all();
  res.json(rows);
});

app.post('/crm/api/activities', requireAuth, (req, res) => {
  const { company_id, contact_id, type, subject, notes, outcome, follow_up_date, completed } = req.body;
  const r = db.prepare(`INSERT INTO activities (company_id,contact_id,type,subject,notes,outcome,follow_up_date,completed) VALUES (?,?,?,?,?,?,?,?)`).run(company_id,contact_id||null,type,subject,notes,outcome,follow_up_date||null,completed?1:0);
  res.json({ id: r.lastInsertRowid });
});

app.put('/crm/api/activities/:id', requireAuth, (req, res) => {
  const { type, subject, notes, outcome, follow_up_date, completed } = req.body;
  db.prepare(`UPDATE activities SET type=?,subject=?,notes=?,outcome=?,follow_up_date=?,completed=? WHERE id=?`).run(type,subject,notes,outcome,follow_up_date||null,completed?1:0,req.params.id);
  res.json({ ok: true });
});

app.delete('/crm/api/activities/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM activities WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/crm/api/import', requireAuth, (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be array' });
  const ins = db.prepare(`INSERT INTO companies (name,hq_state,hq_city,agent_count_min,agent_count_max,website,phone,email,type,status,priority,notes,source) VALUES (@name,@hq_state,@hq_city,@agent_count_min,@agent_count_max,@website,@phone,@email,@type,@status,@priority,@notes,@source)`);
  db.transaction(r => { for (const row of r) ins.run({email:'',notes:'',status:'new',priority:'medium',...row}); })(rows);
  res.json({ imported: rows.length });
});

// ── CRM Frontend ──────────────────────────────────────────────────────────────
app.get('/crm', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'crm.html')));
app.get('/jobs', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'job-tracker.html')));

app.listen(PORT, () => console.log(`CCM site running on http://localhost:${PORT}`));
