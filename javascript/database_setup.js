const sqlite3 = require('sqlite3').verbose();

console.log("Kod çalışmaya başladı.");

// Veritabanı dosyasını oluştur veya aç
const db = new sqlite3.Database('./project_management.db', (err) => {
    if (err) {
        console.error("Veritabanına bağlanırken bir hata oluştu:", err.message);
    } else {
        console.log('Veritabanına bağlanıldı.');
    }
});

// Tabloları oluşturma
db.serialize(() => {
    // Users tablosunu oluştur
    db.run(`
        CREATE TABLE IF NOT EXISTS Users (
            user_id INTEGER PRIMARY KEY,
            username VARCHAR(50),
            email VARCHAR(100),
            password_hash VARCHAR(255),
            role TEXT CHECK(role IN ('Admin', 'Project Manager', 'Member')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error("Users tablosu oluşturulamadı:", err.message);
        else console.log("Users tablosu oluşturuldu.");
    });

    // Projects tablosunu oluştur
    db.run(`
        CREATE TABLE IF NOT EXISTS Projects (
            project_id INTEGER PRIMARY KEY,
            project_name VARCHAR(100),
            description TEXT,
            start_date DATE,
            end_date DATE,
            created_by INTEGER,
            owner_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES Users(user_id),
            FOREIGN KEY (owner_id) REFERENCES Users(user_id)
        )
    `, (err) => {
        if (err) console.error("Projects tablosu oluşturulamadı:", err.message);
        else console.log("Projects tablosu oluşturuldu.");
    });

    // Tasks tablosunu oluştur (İş Listesi)
    db.run(`
        CREATE TABLE IF NOT EXISTS Tasks (
            task_id INTEGER PRIMARY KEY,
            task_name VARCHAR(100),
            description TEXT,
            due_date DATE,
            status TEXT CHECK(status IN ('Pending', 'In Progress', 'Completed')),
            assigned_to INTEGER,
            project_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assigned_to) REFERENCES Users(user_id),
            FOREIGN KEY (project_id) REFERENCES Projects(project_id)
        )
    `, (err) => {
        if (err) console.error("Tasks tablosu oluşturulamadı:", err.message);
        else console.log("Tasks tablosu oluşturuldu.");
    });

 db.run(
    `
    CREATE TABLE IF NOT EXISTS Calendar (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name VARCHAR(100),
    event_description TEXT,
    event_date TIMESTAMP,
    created_by INTEGER,
    project_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_date DATE, -- Bu sütunu ekledik
    FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES Projects(project_id) ON DELETE SET NULL
    )
`, (err) => {
    if (err) {
        console.error("Calendar tablosu oluşturulamadı:", err.message);
    } else {
        console.log("Calendar tablosu başarıyla oluşturuldu.");
    }
});

    // SupportRequests tablosunu oluştur
db.run(`
   CREATE TABLE IF NOT EXISTS Firmalar (
    firma_id INTEGER PRIMARY KEY,
    firma_adi TEXT NOT NULL,
    telefon TEXT,
    yetkili_kisi TEXT,
    gsm TEXT,
    sehir TEXT,
    vergi_dairesi TEXT,
    vergi_no TEXT,
    ilce TEXT,
    adres TEXT,
    tema TEXT,
    user_email TEXT, -- Kullanıcıyı tanımlamak için
    FOREIGN KEY (user_email) REFERENCES Users(email)
);

`, (err) => {
    if (err) console.error("SupportRequests tablosu oluşturulamadı:", err.message);
    else console.log("SupportRequests tablosu oluşturuldu.");
});
db.run(`
    CREATE TABLE IF NOT EXISTS DestekTalepleri (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        departman TEXT NOT NULL,
        konu TEXT NOT NULL,
        aciklama TEXT,
        dosya_adi TEXT,
        durum TEXT DEFAULT 'Açık',
        eklenme_tarihi TEXT DEFAULT CURRENT_TIMESTAMP
    );
`, (err) => {
    if (err) {
        console.error("DestekTalepleri tablosu oluşturulamadı:", err.message);
    } else {
        console.log("DestekTalepleri tablosu başarıyla oluşturuldu.");
    }
});

db.run(`
    CREATE TABLE IF NOT EXISTS personeller (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        status BOOLEAN DEFAULT 1,
        created_by TEXT DEFAULT CURRENT_TIMESTAMP
    );
`, (err) => {
    if (err) {
        console.error("Personeller tablosu oluşturulamadı:", err.message);
    } else {
        console.log("Personeller tablosu başarıyla oluşturuldu.");
    }
});

db.run(`
    CREATE TABLE IF NOT EXISTS Departments (
        department_id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_name VARCHAR(100) NOT NULL,
        department_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`, (err) => {
    if (err) console.error("Departments tablosu oluşturulamadı:", err.message);
    else console.log("Departments tablosu başarıyla oluşturuldu.");
});
db.run(`
    CREATE TABLE IF NOT EXISTS gorevler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name TEXT NOT NULL,
    assigned_to INTEGER DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES personeller(id)
);
`, (err) => {
    if (err) {
        console.error("Gorevler tablosu oluşturulamadı:", err.message);
    } else {
        console.log("Gorevler tablosu başarıyla oluşturuldu.");
    }
});

    // Diğer tabloları eklemek için db.run fonksiyonlarını benzer şekilde ekleyin...
});

// Veritabanı bağlantısını kapatma olayları
db.on("open", () => {
    console.log("Veritabanı bağlantısı açık.");
});

db.on("close", () => {
    console.log("Veritabanı bağlantısı kapatıldı.");
});

// Veritabanı bağlantısını kapat
db.close((err) => {
    if (err) {
        console.error("Veritabanı bağlantısı kapatılamadı:", err.message);
    } else {
        console.log('Veritabanı bağlantısı başarıyla kapatıldı.');
    }
});