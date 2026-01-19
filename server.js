const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// تكوين اتصال قاعدة البيانات - غير كلمة السر هنا
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "clinic_test",
  password: "12345", // ضع كلمة السر الخاصة بك هنا
  port: 5432,
});

// اختبار الاتصال بقاعدة البيانات
pool.connect((err, client, release) => {
  if (err) {
    console.error("خطأ في الاتصال بقاعدة البيانات:", err.message);
  } else {
    console.log("✅ تم الاتصال بقاعدة البيانات بنجاح");
    release();
  }
});

// --- Routes الأساسية ---

// 1️⃣ جلب كل المرضى
app.get("/patients", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM Patients ORDER BY patient_id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب المرضى:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 2️⃣ البحث عن مريض حسب الاسم
app.get("/patients/search/:name", async (req, res) => {
  const { name } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM Patients WHERE first_name ILIKE $1 OR last_name ILIKE $1",
      [`%${name}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في البحث:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 3️⃣ إضافة مريض جديد
app.post("/patients", async (req, res) => {
  const { first_name, last_name, age, phone } = req.body;
  
  // التحقق من البيانات
  if (!first_name || !last_name || !age || !phone) {
    return res.status(400).json({ error: "جميع الحقول مطلوبة" });
  }
  
  try {
    const result = await pool.query(
      "INSERT INTO Patients (first_name, last_name, age, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [first_name, last_name, parseInt(age), phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في إضافة مريض:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 4️⃣ جلب الأطباء
app.get("/doctors", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM Doctors");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب الأطباء:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 5️⃣ جلب المواعيد لليوم الحالي
app.get("/appointments/today", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.appointment_id, 
              p.first_name AS patient_first, 
              p.last_name AS patient_last, 
              d.first_name AS doctor_first, 
              d.last_name AS doctor_last, 
              a.appointment_date 
       FROM Appointments a 
       JOIN Patients p ON a.patient_id = p.patient_id 
       JOIN Doctors d ON a.doctor_id = d.doctor_id 
       WHERE DATE(a.appointment_date) = CURRENT_DATE
       ORDER BY a.appointment_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب المواعيد:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// --- Routes الجديدة التي أضفتها ---

// 6️⃣ جلب مريض محدد
app.get("/patients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM Patients WHERE patient_id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب المريض:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 7️⃣ تحديث بيانات مريض
app.put("/patients/:id", async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, age, phone } = req.body;
  
  try {
    const result = await pool.query(
      "UPDATE Patients SET first_name = $1, last_name = $2, age = $3, phone = $4 WHERE patient_id = $5 RETURNING *",
      [first_name, last_name, age, phone, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تحديث المريض:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 8️⃣ حذف مريض
app.delete("/patients/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM Patients WHERE patient_id = $1 RETURNING *", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    res.json({ message: "Patient deleted successfully", deletedPatient: result.rows[0] });
  } catch (err) {
    console.error("❌ خطأ في حذف المريض:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 9️⃣ إضافة دكتور جديد
app.post("/doctors", async (req, res) => {
  const { first_name, last_name, specialty, phone } = req.body;
  
  if (!first_name || !last_name) {
    return res.status(400).json({ error: "الاسم الأول والأخير مطلوبان" });
  }
  
  try {
    const result = await pool.query(
      "INSERT INTO Doctors (first_name, last_name, specialty, phone) VALUES ($1, $2, $3, $4) RETURNING *",
      [first_name, last_name, specialty || "تخصص عام", phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في إضافة طبيب:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 🔟 جلب الإحصائيات
app.get("/stats", async (req, res) => {
  try {
    const [patients, appointments, doctors] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM Patients"),
      pool.query("SELECT COUNT(*) FROM Appointments WHERE DATE(appointment_date) = CURRENT_DATE"),
      pool.query("SELECT COUNT(*) FROM Doctors")
    ]);
    
    res.json({
      totalPatients: parseInt(patients.rows[0].count),
      appointmentsToday: parseInt(appointments.rows[0].count),
      availableDoctors: parseInt(doctors.rows[0].count)
    });
  } catch (err) {
    console.error("❌ خطأ في جلب الإحصائيات:", err.message);
    res.status(500).json({ error: "Server Error", details: err.message });
  }
});

// 🔧 Route لفحص صحة الخادم
app.get("/health", (req, res) => {
  res.json({ 
    status: "✅ Server is running",
    timestamp: new Date().toISOString(),
    database: "Connected"
  });
});

// 🔧 Route لإنشاء جدول إذا لم يكن موجوداً (للتطوير فقط)
app.get("/setup-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Patients (
        patient_id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        age INTEGER NOT NULL,
        phone VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Doctors (
        doctor_id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        specialty VARCHAR(100),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Appointments (
        appointment_id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES Patients(patient_id),
        doctor_id INTEGER REFERENCES Doctors(doctor_id),
        appointment_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // إضافة بيانات تجريبية إذا كانت الجداول فارغة
    const patientsCount = await pool.query("SELECT COUNT(*) FROM Patients");
    if (parseInt(patientsCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO Patients (first_name, last_name, age, phone) VALUES
        ('محمد', 'أحمد', 25, '0599123456'),
        ('فاطمة', 'خالد', 30, '0599876543'),
        ('علي', 'محمود', 45, '0599112233')
      `);
    }
    
    const doctorsCount = await pool.query("SELECT COUNT(*) FROM Doctors");
    if (parseInt(doctorsCount.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO Doctors (first_name, last_name, specialty, phone) VALUES
        ('أحمد', 'سعيد', 'طب عام', '0599001122'),
        ('سارة', 'عمر', 'أمراض باطنية', '0599334455'),
        ('يوسف', 'علي', 'جراحة', '0599445566')
      `);
    }
    
    res.json({ message: "✅ تم إنشاء/تجهيز قاعدة البيانات بنجاح" });
  } catch (err) {
    console.error("❌ خطأ في إعداد قاعدة البيانات:", err.message);
    res.status(500).json({ error: "Database setup failed", details: err.message });
  }
});

// معالج الأخطاء العام
app.use((err, req, res, next) => {
  console.error("🚨 خطأ غير متوقع:", err.stack);
  res.status(500).json({ 
    error: "Internal Server Error",
    message: "حدث خطأ غير متوقع في الخادم"
  });
});

// Route غير موجود
app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.path });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🛠  Setup DB: http://localhost:${PORT}/setup-db`);
});