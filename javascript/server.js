const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;

const secret = 'secret_token'; // Tüm token işlemleri için ortak anahtar

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('css'));
app.use(express.static('html'));
app.use(express.static('image'));
app.use(express.static('javascript'));

// Session middleware
app.use(cookieParser());
app.use(session({
    secret: 'session_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // 1 saatlik oturum süresi
}));

// Body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Root Route to serve login page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});

// Database connection
const db = new sqlite3.Database('./project_management.db', (err) => {
    if (err) {
        console.error("Error connecting to database:", err.message);
    } else {
        console.log("Connected to database successfully.");
    }
});

// Middleware to protect routes
const authenticateJWT = (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send('Access Denied');
    }

    const token = authHeader.replace('Bearer ', '');
    try {
        const verified = jwt.verify(token, secret);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).send('Invalid Token');
    }
};

// Register Route with Token
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!password) {
        return res.status(400).send("Şifre eksik.");
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)`, [username, email, passwordHash], function (err) {
            if (err) {
                console.error("Register error:", err.message);
                res.status(500).send("Database error.");
            } else {
                const token = jwt.sign({ userId: this.lastID, username, email }, secret, { expiresIn: '1h' });
                res.header('Authorization', 'Bearer ' + token).send({ success: true, token });
            }
        });
    } catch (error) {
        console.error("Password hashing error:", error.message);
        res.status(500).send("Password processing error.");
    }
});

// Login Route
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM Users WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            console.error("Login error:", err.message);
            res.status(500).send("Error during login.");
        } else if (!user) {
            res.status(401).send("User not found or password incorrect.");
        } else {
            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                req.session.username = user.username;
                req.session.userId = user.id;
                const token = jwt.sign({ email: user.email, userId: user.id }, secret, { expiresIn: '1h' });
                res.header('Authorization', 'Bearer ' + token).send('Logged in');
            } else {
                res.status(401).send("User not found or password incorrect.");
            }
        }
    });
});

// Middleware to check if user is authenticated
function checkAuth(req, res, next) {
    if (req.session.username) {
        next();
    } else {
        res.redirect('/');
    }
}

// Route to serve index.html with username
app.get('/index', checkAuth, (req, res) => {
    res.sendFile(__dirname + '/html/index.html');
});

// Route to get username for index.html
app.get('/get-username', (req, res) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token not provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, secret);
        const email = decoded.email;

        db.get('SELECT username FROM Users WHERE email = ?', [email], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ username: user.username });
        });
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Proje oluşturma isteği işleme
app.post('/create-project', authenticateJWT, multer().none(), (req, res) => {
    const { projectName, description, startDate, endDate } = req.body;
    const { email } = req.user; // Token'dan kullanıcı e-posta bilgisi alınıyor

    if (!projectName || !description || !startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Lütfen tüm alanları doldurun.' });
    }

    // Kullanıcı ID'sini e-posta üzerinden al
    db.get('SELECT user_id FROM Users WHERE email = ?', [email], (err, user) => {
        if (err || !user) {
            console.error("Kullanıcı bulunamadı veya bir hata oluştu:", err?.message || 'No user found');
            return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const userId = user.user_id;
        const query = `
            INSERT INTO Projects (project_name, description, start_date, end_date, created_by, owner_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.run(query, [projectName, description, startDate, endDate, userId, userId], function (err) {
            if (err) {
                console.error("Proje eklenemedi:", err.message);
                return res.status(500).json({ success: false, message: 'Proje eklenirken bir hata oluştu.' });
            }
            res.status(201).json({ success: true, message: 'Proje başarıyla oluşturuldu.', projectId: this.lastID });
            console.log("Yeni proje eklendi, proje ID'si:", this.lastID);
        });
    });
});

// Mevcut projeleri listeleme
app.get('/current-projects', authenticateJWT, (req, res) => {
    const { email } = req.user; // Token'dan kullanıcı e-posta bilgisi alınıyor

    // Kullanıcı ID'sini e-posta üzerinden al
    db.get('SELECT user_id FROM Users WHERE email = ?', [email], (err, user) => {
        if (err || !user) {
            console.error("Kullanıcı bulunamadı veya bir hata oluştu:", err?.message || 'No user found');
            return res.status(404).json({ projects: [], message: 'Kullanıcı bulunamadı.' });
        }

        const userId = user.user_id;
        const query = `SELECT * FROM Projects WHERE end_date > CURRENT_DATE AND (created_by = ? OR owner_id = ?)`;
        db.all(query, [userId, userId], (err, rows) => {
            if (err) {
                console.error("Mevcut projeler alınamadı:", err.message);
                return res.status(500).json({ projects: [], message: 'Projeler alınırken bir hata oluştu.' });
            }
            res.json({ projects: rows });
        });
    });
});

// Geçmiş projeleri listeleme
app.get('/past-projects', authenticateJWT, (req, res) => {
    const { email } = req.user; // Token'dan kullanıcı e-posta bilgisi alınıyor

    // Kullanıcı ID'sini e-posta üzerinden al
    db.get('SELECT user_id FROM Users WHERE email = ?', [email], (err, user) => {
        if (err || !user) {
            console.error("Kullanıcı bulunamadı veya bir hata oluştu:", err?.message || 'No user found');
            return res.status(404).json({ projects: [], message: 'Kullanıcı bulunamadı.' });
        }

        const userId = user.user_id;
        const query = `SELECT * FROM Projects WHERE end_date <= CURRENT_DATE AND (created_by = ? OR owner_id = ?)`;
        db.all(query, [userId, userId], (err, rows) => {
            if (err) {
                console.error("Geçmiş projeler alınamadı:", err.message);
                return res.status(500).json({ projects: [], message: 'Projeler alınırken bir hata oluştu.' });
            }
            res.json({ projects: rows });
        });
    });
});

// Logout Route
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Logout failed.');
        }
        res.clearCookie('connect.sid');
        res.status(200).send('Logged out successfully.');
    });
});
app.post('/update-firm-info', authenticateJWT, (req, res) => {
    const { firmaAdi, firmaTelefon, yetkiliKisi, firmaGSM, firmaSehir, firmaVergiDairesi, firmaVergiNo, firmaIlce, firmaAdres, tema } = req.body;
    const { email } = req.user;

    const selectQuery = `
        SELECT COUNT(*) AS count
        FROM Firmalar
        WHERE user_email = ?;
    `;

    db.get(selectQuery, [email], (err, row) => {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({ success: false, message: "Sorgulama sırasında bir hata oluştu." });
        }

        const isRecordExists = row.count > 0;

        if (isRecordExists) {
            // Kayıt varsa UPDATE işlemi
            const updateQuery = `
                UPDATE Firmalar
                SET firma_adi = ?, telefon = ?, yetkili_kisi = ?, gsm = ?, sehir = ?, vergi_dairesi = ?, vergi_no = ?, ilce = ?, adres = ?, tema = ?
                WHERE user_email = ?;
            `;

            db.run(updateQuery, [firmaAdi, firmaTelefon, yetkiliKisi, firmaGSM, firmaSehir, firmaVergiDairesi, firmaVergiNo, firmaIlce, firmaAdres, tema, email], function (err) {
                if (err) {
                    console.error("Database error:", err.message);
                    return res.status(500).json({ success: false, message: "Güncelleme sırasında bir hata oluştu." });
                }
                res.status(200).json({ success: true, message: "Firma bilgileri güncellendi." });
            });
        } else {
            // Kayıt yoksa INSERT işlemi
            const insertQuery = `
                INSERT INTO Firmalar (firma_adi, telefon, yetkili_kisi, gsm, sehir, vergi_dairesi, vergi_no, ilce, adres, tema, user_email)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;

            db.run(insertQuery, [firmaAdi, firmaTelefon, yetkiliKisi, firmaGSM, firmaSehir, firmaVergiDairesi, firmaVergiNo, firmaIlce, firmaAdres, tema, email], function (err) {
                if (err) {
                    console.error("Database error:", err.message);
                    return res.status(500).json({ success: false, message: "Ekleme sırasında bir hata oluştu." });
                }
                res.status(200).json({ success: true, message: "Firma bilgileri eklendi." });
            });
        }
    });
});


// Multer ayarları (Dosya yükleme için)
const upload = multer({ dest: 'uploads/' });

// Destek talebi ekleme
app.post('/add-support-request', authenticateJWT, upload.single('file'), (req, res) => {
    const { departman, konu, aciklama } = req.body;
    const { email } = req.user; // Kullanıcının e-posta adresi
    const dosyaAdi = req.file ? req.file.filename : null;

    const query = `
        INSERT INTO DestekTalepleri (user_email, departman, konu, aciklama, dosya_adi)
        VALUES (?, ?, ?, ?, ?);
    `;

    db.run(query, [email, departman, konu, aciklama, dosyaAdi], function (err) {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({ success: false, message: "Destek talebi eklenirken hata oluştu." });
        }
        res.status(200).json({ success: true, message: "Destek talebi başarıyla oluşturuldu.", id: this.lastID });
    });
});

// Kullanıcının destek taleplerini listeleme
app.get('/get-support-requests', authenticateJWT, (req, res) => {
    const { email } = req.user;

    const query = `
        SELECT id, departman, konu, durum, eklenme_tarihi
        FROM DestekTalepleri
        WHERE user_email = ?;
    `;

    db.all(query, [email], (err, rows) => {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({ success: false, message: "Talepler alınırken hata oluştu." });
        }
        res.status(200).json({ success: true, data: rows });
    });
});

// Destek talebini güncelleme (Durum değiştirme)
app.post('/update-support-request', authenticateJWT, (req, res) => {
    const { id, durum } = req.body;
    const { email } = req.user;

    const query = `
        UPDATE DestekTalepleri
        SET durum = ?
        WHERE id = ? AND user_email = ?;
    `;

    db.run(query, [durum, id, email], function (err) {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({ success: false, message: "Talep güncellenirken hata oluştu." });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: "Talep bulunamadı." });
        }

        res.status(200).json({ success: true, message: "Talep başarıyla güncellendi." });
    });
});
// Not ekleme (add-note)
app.post('/add-note', authenticateJWT, (req, res) => {
    const { note_content, note_date } = req.body; // Kullanıcıdan gelen alanlar
    const { email } = req.user; // Token'dan gelen email

    const currentDate = new Date(); // Şu anki tarih ve saat
    const userDate = new Date(note_date); // Kullanıcının gönderdiği tarih

    // Geçmiş tarih kontrolü
    if (userDate < currentDate) {
        return res.status(400).json({ success: false, message: "Geçmiş bir tarihe not eklenemez." });
    }

    // Kullanıcının user_id'sini almak
    const userQuery = `SELECT user_id FROM Users WHERE email = ?`;
    db.get(userQuery, [email], (err, user) => {
        if (err || !user) {
            console.error("Kullanıcı doğrulama hatası:", err?.message);
            return res.status(404).json({ success: false, message: "Kullanıcı doğrulanamadı." });
        }

        const userId = user.user_id;

        // Calendar tablosuna not ekleme
        const insertQuery = `
            INSERT INTO Calendar (event_description, user_date, created_by, created_at)
            VALUES (?, ?, ?, datetime('now'))
        `;

        db.run(insertQuery, [note_content, note_date, userId], function (err) {
            if (err) {
                console.error("Veritabanı ekleme hatası:", err.message);
                return res.status(500).json({ success: false, message: "Not eklenirken bir hata oluştu." });
            }
            res.status(200).json({ success: true, event_id: this.lastID });
        });
    });
});

// Notları getirme (get-notes)
app.get('/get-notes', authenticateJWT, (req, res) => {
    const { email } = req.user; // Token'dan email bilgisi
    const currentDate = new Date(); // Şu anki tarih

    // Kullanıcının user_id'sini almak
    const userQuery = `SELECT user_id FROM Users WHERE email = ?`;
    db.get(userQuery, [email], (err, user) => {
        if (err) {
            console.error("Kullanıcı sorgusu hatası:", err.message);
            return res.status(500).json({ success: false, message: "Kullanıcı bilgisi alınırken bir hata oluştu." });
        }
        if (!user) {
            console.error("Kullanıcı bulunamadı:", email);
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        const userId = user.user_id;

        // Calendar tablosundan notları listeleme
        const selectQuery = `
            SELECT event_id, event_description, user_date AS user_input_date, created_at
            FROM Calendar
            WHERE created_by = ? AND user_date >= ?
            ORDER BY created_at DESC
        `;

        db.all(selectQuery, [userId, currentDate.toISOString()], (err, rows) => {
            if (err) {
                console.error("Calendar tablosu sorgu hatası:", err.message);
                return res.status(500).json({ success: false, message: "Veritabanı sorgu hatası." });
            }

            if (rows.length === 0) {
                return res.status(200).json({ success: true, data: [], message: "Hiç not bulunamadı." });
            }

            console.log("Notlar başarıyla alındı:", rows);
            res.status(200).json({ success: true, data: rows });
        });
    });
});
app.delete('/delete-note/:id', authenticateJWT, (req, res) => {
    const { id } = req.params; // Silinecek notun ID'si
    const { email } = req.user; // Kullanıcının kimliği (JWT'den)

    // Kullanıcının `user_id`'sini almak
    const userQuery = `SELECT user_id FROM Users WHERE email = ?`;
    db.get(userQuery, [email], (err, user) => {
        if (err || !user) {
            console.error("Kullanıcı doğrulama hatası:", err?.message);
            return res.status(404).json({ success: false, message: "Kullanıcı doğrulanamadı." });
        }

        const userId = user.user_id;

        // Notu silme işlemi
        const deleteQuery = `
            DELETE FROM Calendar
            WHERE event_id = ? AND created_by = ?
        `;
        db.run(deleteQuery, [id, userId], function (err) {
            if (err) {
                console.error("Veritabanı silme hatası:", err.message);
                return res.status(500).json({ success: false, message: "Not silinirken bir hata oluştu." });
            }

            if (this.changes === 0) {
                return res.status(404).json({ success: false, message: "Not bulunamadı veya yetkiniz yok." });
            }

            res.status(200).json({ success: true, message: "Not başarıyla silindi." });
        });
    });
});

//Görevleri Ekle
app.post('/add-task', authenticateJWT, (req, res) => {
    const { task_name, description, due_date, status, project_id } = req.body;
    const { email } = req.user; // Token'dan email bilgisi

    // Kullanıcının user_id'sini email ile buluyoruz.
    const getUserIdQuery = `SELECT user_id FROM Users WHERE email = ?`;
    db.get(getUserIdQuery, [email], (err, user) => {
        if (err) {
            console.error("Kullanıcı bilgisi alınamadı:", err.message);
            return res.status(500).json({ success: false, message: "Kullanıcı bilgisi alınamadı." });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        const userId = user.user_id;

        // Görev ekleme sorgusu
        const insertTaskQuery = `
            INSERT INTO Tasks (task_name, description, due_date, status, assigned_to, project_id)
            VALUES (?, ?, ?, ?, ?, ?);
        `;
        db.run(insertTaskQuery, [task_name, description, due_date, status, userId, project_id], function (err) {
            if (err) {
                console.error("Görev eklenirken hata oluştu:", err.message);
                return res.status(500).json({ success: false, message: "Görev eklenirken hata oluştu." });
            }
            res.status(200).json({ success: true, message: "Görev başarıyla eklendi.", id: this.lastID });
        });
    });
});


// Görevleri Listele
app.get('/get-tasks', authenticateJWT, (req, res) => {
    const { email } = req.user;

    const query = `
        SELECT t.task_id, t.task_name, t.description, t.due_date, t.status, t.created_at
        FROM Tasks t
        JOIN Users u ON t.assigned_to = u.user_id
        WHERE u.email = ?
        ORDER BY t.due_date ASC;
    `;
    db.all(query, [email], (err, rows) => {
        if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({ success: false, message: "Görevler alınırken hata oluştu." });
        }
        res.status(200).json({ success: true, data: rows });
    });
});

// Kullanıcı ekleme
app.post("/add-personnel", authenticateJWT, multer().none(), (req, res) => {
    const { name, phone, email, role } = req.body;
    const { email: userEmail } = req.user; // Token'dan kullanıcı e-postası alınıyor

    if (!name || !email || !role) {
        return res.status(400).json({ success: false, message: "Lütfen tüm alanları doldurun." });
    }

    // Kullanıcı ID'sini e-posta üzerinden al
    const getUserIdQuery = `SELECT user_id FROM Users WHERE email = ?`;
    db.get(getUserIdQuery, [userEmail], (err, user) => {
        if (err || !user) {
            console.error("Kullanıcı bulunamadı veya bir hata oluştu:", err?.message || "No user found");
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        const userId = user.user_id;
        const insertPersonnelQuery = `
            INSERT INTO personeller (name, phone, email, role, created_by)
            VALUES (?, ?, ?, ?, ?)
        `;
        db.run(insertPersonnelQuery, [name, phone, email, role, userId], function (err) {
            if (err) {
                console.error("Personel eklenirken hata oluştu:", err.message);
                return res.status(500).json({ success: false, message: "Personel eklenirken hata oluştu.", error: err.message });
            }
            res.status(201).json({ success: true, message: "Personel başarıyla eklendi.", id: this.lastID });
            console.log("Yeni personel eklendi, personel ID'si:", this.lastID);
        });
    });
});

// Tüm personelleri listeleme
app.get("/get-personnels", authenticateJWT, (req, res) => {
    const getPersonnelQuery = `SELECT * FROM personeller`;

    db.all(getPersonnelQuery, [], (err, rows) => {
        if (err) {
            console.error("Personeller getirilirken hata oluştu:", err.message);
            return res.status(500).json({ success: false, message: "Personeller getirilirken hata oluştu.", error: err.message });
        }

        res.status(200).json({ success: true, data: rows });
    });
});

// Kullanıcı silme
app.delete("/delete-personnel/:id", authenticateJWT, (req, res) => {
    const personnelId = req.params.id;

    const deletePersonnelQuery = `DELETE FROM personeller WHERE id = ?`;

    db.run(deletePersonnelQuery, [personnelId], function (err) {
        if (err) {
            console.error("Personel silinirken hata oluştu:", err.message);
            return res.status(500).json({ success: false, message: "Personel silinirken hata oluştu.", error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: "Personel bulunamadı." });
        }

        res.status(200).json({ success: true, message: "Personel başarıyla silindi." });
    });
});
// Şifre güncelleme
app.post('/update-password', authenticateJWT, (req, res) => {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
        return res.status(400).json({ message: 'Tüm alanları doldurun.' });
    }

    if (new_password.length < 6) {
        return res.status(400).json({ message: 'Yeni şifre en az 6 karakter olmalı.' });
    }

    const userEmail = req.user.email;

    db.get('SELECT password_hash FROM Users WHERE email = ?', [userEmail], async (err, row) => {
        if (err) {
            console.error('Veritabanı hatası:', err.message);
            return res.status(500).json({ message: 'Bir hata oluştu.' });
        }

        if (!row || !(await bcrypt.compare(current_password, row.password_hash))) {
            return res.status(400).json({ message: 'Mevcut şifre yanlış.' });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);
        db.run('UPDATE Users SET password_hash = ? WHERE email = ?', [hashedPassword, userEmail], (err) => {
            if (err) {
                console.error('Şifre güncelleme hatası:', err.message);
                return res.status(500).json({ message: 'Şifre güncellenemedi.' });
            }
            res.json({ message: 'Şifre başarıyla güncellendi.' });
        });
    });
});

// E-posta güncelleme
app.post('/update-email', authenticateJWT, (req, res) => {
    const { new_email, password } = req.body;

    if (!new_email || !password) {
        return res.status(400).json({ message: 'Tüm alanları doldurun.' });
    }

    const userEmail = req.user.email;

    db.get('SELECT password_hash FROM Users WHERE email = ?', [userEmail], async (err, row) => {
        if (err) {
            console.error('Veritabanı hatası:', err.message);
            return res.status(500).json({ message: 'Bir hata oluştu.' });
        }

        if (!row || !(await bcrypt.compare(password, row.password_hash))) {
            return res.status(400).json({ message: 'Mevcut şifre yanlış.' });
        }

        db.run('UPDATE Users SET email = ? WHERE email = ?', [new_email, userEmail], (err) => {
            if (err) {
                console.error('E-posta güncelleme hatası:', err.message);
                return res.status(500).json({ message: 'E-posta güncellenemedi.' });
            }
            res.json({ message: 'E-posta başarıyla güncellendi.' });
        });
    });
});

// Departman Ekleme
app.post('/add-department', authenticateJWT, (req, res) => {
    const { department_name, department_type } = req.body;
    const { email } = req.user; // Token'dan gelen email bilgisi

    if (!department_name || !department_type) {
        return res.status(400).json({ success: false, message: "Departman adı ve türü gereklidir." });
    }

    // Kullanıcının user_id'sini buluyoruz
    const getUserIdQuery = `SELECT user_id FROM Users WHERE email = ?`;
    db.get(getUserIdQuery, [email], (err, user) => {
        if (err) {
            console.error("Kullanıcı bilgisi alınamadı:", err.message);
            return res.status(500).json({ success: false, message: "Kullanıcı bilgisi alınamadı." });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı." });
        }

        const insertQuery = `
            INSERT INTO Departments (department_name, department_type)
            VALUES (?, ?);
        `;

        db.run(insertQuery, [department_name, department_type], function (err) {
            if (err) {
                console.error("Departman eklenirken hata oluştu:", err.message);
                return res.status(500).json({ success: false, message: "Departman eklenirken hata oluştu." });
            }
            res.status(200).json({ success: true, message: "Departman başarıyla eklendi.", id: this.lastID });
        });
    });
});

// Departmanları Listele
app.get('/get-departments', authenticateJWT, (req, res) => {
    const query = `
        SELECT department_id, department_name, department_type, created_at
        FROM Departments
        ORDER BY created_at DESC;
    `;

    db.all(query, [], (err, rows) => {
        if (err) {
            console.error("Departmanlar alınırken hata oluştu:", err.message);
            return res.status(500).json({ success: false, message: "Departmanlar alınırken hata oluştu." });
        }

        res.status(200).json({ success: true, data: rows });
    });
});

// Departman Silme
app.delete('/delete-department/:id', authenticateJWT, (req, res) => {
    const departmentId = req.params.id;

    if (!departmentId) {
        return res.status(400).json({ success: false, message: "Departman ID gereklidir." });
    }

    const deleteQuery = `
        DELETE FROM Departments WHERE department_id = ?;
    `;

    db.run(deleteQuery, [departmentId], function (err) {
        if (err) {
            console.error("Departman silinirken hata oluştu:", err.message);
            return res.status(500).json({ success: false, message: "Departman silinirken hata oluştu." });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: "Departman bulunamadı." });
        }

        res.status(200).json({ success: true, message: "Departman başarıyla silindi." });
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}/login.html`);
});
