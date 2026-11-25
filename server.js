const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, 'gym.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(`
CREATE TABLE IF NOT EXISTS plans (id INTEGER PRIMARY KEY, name TEXT NOT NULL, months INTEGER NOT NULL, price REAL NOT NULL, perks TEXT NOT NULL, hot INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, name TEXT NOT NULL, trainer TEXT NOT NULL, weekday INTEGER NOT NULL, time TEXT NOT NULL, minutes INTEGER DEFAULT 60, capacity INTEGER NOT NULL, base_booked INTEGER DEFAULT 0, img TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, plan_id INTEGER NOT NULL REFERENCES plans(id), starts TEXT NOT NULL, ends TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), class_id INTEGER NOT NULL REFERENCES classes(id), date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'booked', created_at TEXT NOT NULL DEFAULT (datetime('now')));
`);

function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM plans').get().c) return;
  const P = db.prepare('INSERT INTO plans (name,months,price,perks,hot) VALUES (?,?,?,?,?)');
  P.run('شهري', 1, 550, 'دخول الجيم كل يوم|حصة جروب واحدة في الأسبوع|دولاب شخصي', 0);
  P.run('3 شهور', 3, 1400, 'دخول الجيم كل يوم|حصص الجروب مفتوحة|تقييم InBody مجاني|دولاب شخصي', 1);
  P.run('سنوي', 12, 4500, 'كل مميزات 3 شهور|جلستين تدريب شخصي|تجميد شهر|ضيف مجاني كل شهر', 0);
  const C = db.prepare('INSERT INTO classes (name,trainer,weekday,time,minutes,capacity,base_booked,img) VALUES (?,?,?,?,?,?,?,?)');
  // weekday: 0=Sun ... 6=Sat
  [
    ['بوكسينج', 'كابتن كريم', 6, '18:00', 60, 16, 11, 'boxing'],
    ['كروس فيت', 'كابتن هاني', 6, '20:00', 60, 14, 9, 'cross'],
    ['يوجا', 'كابتن سلمى', 0, '10:00', 60, 15, 6, 'yoga'],
    ['سبينج', 'كابتن مروان', 0, '19:00', 45, 12, 10, 'spin'],
    ['كور وإطالة', 'كابتن سلمى', 1, '18:30', 45, 18, 7, 'core'],
    ['بوكسينج', 'كابتن كريم', 1, '20:00', 60, 16, 5, 'boxing'],
    ['كروس فيت', 'كابتن هاني', 2, '19:00', 60, 14, 12, 'cross'],
    ['سبينج', 'كابتن مروان', 3, '18:00', 45, 12, 4, 'spin'],
    ['كيتل بيل', 'كابتن هاني', 3, '20:00', 50, 12, 8, 'kettle'],
    ['يوجا', 'كابتن سلمى', 4, '11:00', 60, 15, 3, 'yoga']
  ].forEach(c => C.run(...c));
}
seed();

const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(express.static(process.env.PUBLIC_DIR || path.join(__dirname, 'public')));
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const tokens = new Set();
const clean = s => String(s || '').trim();

function cairoNow() { return new Date(Date.now() + 2 * 3600e3); }
function iso(d) { return d.toISOString().slice(0, 10); }
function nextDate(weekday, time) {
  const n = cairoNow(); const d = new Date(n);
  let add = (weekday - n.getUTCDay() + 7) % 7;
  if (add === 0 && time <= n.toISOString().slice(11, 16)) add = 7;
  d.setUTCDate(d.getUTCDate() + add); return iso(d);
}
function classView(c) {
  const date = nextDate(c.weekday, c.time);
  const real = db.prepare("SELECT COUNT(*) n FROM bookings WHERE class_id=? AND date=? AND status='booked'").get(c.id, date).n;
  const booked = Math.min(c.capacity, c.base_booked + real);
  return { id: c.id, name: c.name, trainer: c.trainer, weekday: c.weekday, time: c.time, minutes: c.minutes, capacity: c.capacity, booked, left: c.capacity - booked, date, img: c.img };
}

app.get('/api/plans', (req, res) => res.json(db.prepare('SELECT * FROM plans ORDER BY months').all().map(p => ({ ...p, perks: p.perks.split('|') }))));
app.get('/api/classes', (req, res) => res.json(db.prepare('SELECT * FROM classes WHERE active=1 ORDER BY ((weekday+1)%7), time').all().map(classView)));

app.post('/api/join', (req, res) => {
  const { name, phone, plan_id, starts } = req.body || {};
  if (!clean(name) || !clean(phone)) return res.status(400).json({ error: 'الاسم ورقم الموبايل مطلوبين' });
  if (!/^[0-9+\s-]{8,15}$/.test(clean(phone))) return res.status(400).json({ error: 'رقم الموبايل غير صحيح' });
  const plan = db.prepare('SELECT * FROM plans WHERE id=?').get(Number(plan_id));
  if (!plan) return res.status(400).json({ error: 'اختار باقة' });
  const today = iso(cairoNow());
  const s = /^\d{4}-\d{2}-\d{2}$/.test(clean(starts)) && clean(starts) >= today ? clean(starts) : today;
  const e = new Date(s + 'T00:00:00Z'); e.setUTCMonth(e.getUTCMonth() + plan.months);
  const code = 'GM-' + crypto.randomInt(1000, 9999);
  try {
    db.prepare('INSERT INTO members (code,name,phone,plan_id,starts,ends) VALUES (?,?,?,?,?,?)').run(code, clean(name).slice(0, 80), clean(phone), plan.id, s, iso(e));
  } catch (err) { return res.status(500).json({ error: 'حصل خطأ، حاول تاني' }); }
  res.status(201).json({ code, plan: plan.name, price: plan.price, starts: s, ends: iso(e) });
});

function memberView(m) {
  const plan = db.prepare('SELECT name,price FROM plans WHERE id=?').get(m.plan_id);
  const bookings = db.prepare(`SELECT b.id,b.date,b.status,c.name,c.time,c.trainer FROM bookings b JOIN classes c ON c.id=b.class_id WHERE b.member_id=? ORDER BY b.date DESC, b.id DESC LIMIT 20`).all(m.id);
  return { code: m.code, name: m.name, plan: plan.name, starts: m.starts, ends: m.ends, active: m.ends >= iso(cairoNow()), bookings };
}
app.get('/api/member/:code', (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE code=?').get(String(req.params.code).trim().toUpperCase());
  if (!m) return res.status(404).json({ error: 'مفيش عضوية بالكود ده' });
  res.json(memberView(m));
});
app.post('/api/book', (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE code=?').get(clean(req.body && req.body.code).toUpperCase());
  if (!m) return res.status(404).json({ error: 'كود العضوية غلط. اشترك الأول أو اكتب الكود صح' });
  const c = db.prepare('SELECT * FROM classes WHERE id=? AND active=1').get(Number(req.body.class_id));
  if (!c) return res.status(404).json({ error: 'الحصة مش موجودة' });
  const v = classView(c);
  if (m.ends < v.date || m.starts > v.date) return res.status(400).json({ error: 'عضويتك مش سارية في ميعاد الحصة دي' });
  if (db.prepare("SELECT 1 FROM bookings WHERE member_id=? AND class_id=? AND date=? AND status='booked'").get(m.id, c.id, v.date)) return res.status(400).json({ error: 'انت حاجز الحصة دي بالفعل' });
  if (v.left <= 0) return res.status(409).json({ error: 'الحصة كاملة العدد' });
  db.prepare('INSERT INTO bookings (member_id,class_id,date) VALUES (?,?,?)').run(m.id, c.id, v.date);
  res.status(201).json({ ok: true, name: c.name, date: v.date, time: c.time, trainer: c.trainer, left: v.left - 1 });
});
app.post('/api/cancel', (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE code=?').get(clean(req.body && req.body.code).toUpperCase());
  if (!m) return res.status(404).json({ error: 'كود غلط' });
  const r = db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND member_id=? AND status='booked'").run(Number(req.body.booking_id), m.id);
  if (!r.changes) return res.status(404).json({ error: 'الحجز مش موجود' });
  res.json({ ok: true });
});

app.post('/api/admin/login', (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'كلمة السر غلط' });
  const t = crypto.randomBytes(24).toString('hex'); tokens.add(t); res.json({ token: t });
});
function auth(req, res, next) {
  if (!tokens.has((req.headers.authorization || '').replace('Bearer ', ''))) return res.status(401).json({ error: 'لازم تسجل دخول' });
  next();
}
app.get('/api/admin/stats', auth, (req, res) => {
  const m = db.prepare('SELECT COUNT(*) n FROM members').get().n;
  const rev = db.prepare('SELECT COALESCE(SUM(p.price),0) s FROM members m JOIN plans p ON p.id=m.plan_id').get().s;
  const b = db.prepare("SELECT COUNT(*) n FROM bookings WHERE status='booked'").get().n;
  res.json({ members: m, revenue: rev, bookings: b });
});
app.get('/api/admin/members', auth, (req, res) => res.json(db.prepare('SELECT m.code,m.name,m.phone,m.starts,m.ends,p.name plan FROM members m JOIN plans p ON p.id=m.plan_id ORDER BY m.id DESC LIMIT 100').all()));
app.get('/api/admin/bookings', auth, (req, res) => res.json(db.prepare("SELECT b.id,b.date,b.status,m.name member,m.code,c.name class,c.time FROM bookings b JOIN members m ON m.id=b.member_id JOIN classes c ON c.id=b.class_id ORDER BY b.id DESC LIMIT 100").all()));
app.get('/api/admin/classes', auth, (req, res) => res.json(db.prepare('SELECT * FROM classes WHERE active=1 ORDER BY ((weekday+1)%7), time').all().map(classView)));
app.patch('/api/admin/classes/:id', auth, (req, res) => {
  const cap = Math.floor(Number(req.body && req.body.capacity));
  if (!(cap >= 1 && cap <= 100)) return res.status(400).json({ error: 'السعة غير صحيحة' });
  const r = db.prepare('UPDATE classes SET capacity=? WHERE id=?').run(cap, Number(req.params.id));
  res.json({ ok: !!r.changes });
});
app.delete('/api/admin/classes/:id', auth, (req, res) => { db.prepare('UPDATE classes SET active=0 WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
app.post('/api/admin/classes', auth, (req, res) => {
  const { name, trainer, weekday, time, capacity, img } = req.body || {};
  if (!clean(name) || !clean(trainer) || !/^\d{2}:\d{2}$/.test(clean(time)) || !(Number(capacity) >= 1) || !(Number(weekday) >= 0 && Number(weekday) <= 6)) return res.status(400).json({ error: 'بيانات الحصة ناقصة' });
  db.prepare('INSERT INTO classes (name,trainer,weekday,time,capacity,img) VALUES (?,?,?,?,?,?)').run(clean(name).slice(0, 60), clean(trainer).slice(0, 60), Number(weekday), clean(time), Math.floor(Number(capacity)), ['boxing','cross','yoga','spin','core','kettle'].includes(img) ? img : 'cross');
  res.status(201).json({ ok: true });
});
app.patch('/api/admin/plans/:id', auth, (req, res) => {
  const p = Number(req.body && req.body.price);
  if (!(p > 0 && p < 100000)) return res.status(400).json({ error: 'سعر غير صحيح' });
  res.json({ ok: !!db.prepare('UPDATE plans SET price=? WHERE id=?').run(p, Number(req.params.id)).changes });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Core Gym demo on ' + port));
