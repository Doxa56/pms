// Kullanıcı adı yükleme ve token doğrulama
document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Token not found');
        redirectToLogin();
        return;
    }

    fetch('/get-username', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Kullanıcı bilgisi alınamadı');
            }
            return response.json();
        })
        .then(data => {
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                usernameElement.textContent = data.username;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            redirectToLogin();
        });

    loadProjects('/current-projects'); // Varsayılan olarak mevcut projeleri yükle
});

// Login sayfasına yönlendirme
function redirectToLogin() {
    window.location.href = '/login.html';
}

// Profil menüsü aç/kapat
const dropdownToggle = document.getElementById("dropdownToggle");
const dropdownMenu = document.getElementById("dropdownMenu");

if (dropdownToggle && dropdownMenu) {
    dropdownToggle.addEventListener("click", () => {
        dropdownMenu.style.display = dropdownMenu.style.display === "block" ? "none" : "block";
    });

    document.addEventListener("click", (event) => {
        if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.style.display = "none";
        }
    });
}

// Alt menü kontrolü
function toggleSubMenu(submenuId) {
    const submenu = document.getElementById(submenuId);
    if (submenu) {
        submenu.style.display = submenu.style.display === "block" ? "none" : "block";
    }
}

document.querySelectorAll('.submenu li a').forEach(item => {
    item.addEventListener('click', function () {
        document.querySelectorAll('.submenu li a').forEach(el => el.classList.remove('active'));
        this.classList.add('active');
    });
});
function logout() {
    fetch('/logout', {
        method: 'POST',
        credentials: 'include' // Oturum bilgilerini dahil etmek için
    })
        .then(response => {
            if (response.ok) {
                localStorage.removeItem('token'); // Token temizleme
                window.location.href = '/login.html'; // Login sayfasına yönlendirme
            } else {
                console.error('Logout failed');
            }
        })
        .catch(error => console.error('Error:', error));
}


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

// Projeleri al ve ekrana yükle
function loadProjects(endpoint) {
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return;
    }

    fetch(endpoint, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Proje bilgileri alınamadı');
            }
            return response.json();
        })
        .then(data => {
            displayProjects(data.projects);
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById("projectContent").innerHTML = "<p>Projeler yüklenemedi.</p>";
        });
}

// Projeleri ekrana yazdır
function displayProjects(projects) {
    const projectContent = document.getElementById("projectContent");
    if (!projectContent) return;

    projectContent.innerHTML = "";

    if (!projects || projects.length === 0) {
        projectContent.innerHTML = "<p>Gösterilecek proje bulunamadı.</p>";
        return;
    }

    const projectList = document.createElement("ul");
    projects.forEach(project => {
        const projectItem = document.createElement("li");
        projectItem.innerHTML = `<strong>${project.project_name}</strong><br>
            Açıklama: ${project.description}<br>
            Başlangıç Tarihi: ${project.start_date}<br>
            Bitiş Tarihi: ${project.end_date}`;
        projectList.appendChild(projectItem);
    });

    projectContent.appendChild(projectList);
}


// Menüden sayfa yükleme
function loadContent(url, activeButton) {
    const token = localStorage.getItem('token');
    if (!token) {
        redirectToLogin();
        return;
    }

    fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Sayfa yüklenemedi.');
            }
            return response.text();
        })
        .then(data => {
            const contentArea = document.querySelector(".content");
            if (contentArea) {
                contentArea.innerHTML = data;
            }
        })
        .catch(error => console.error('Error:', error));

    document.querySelectorAll(".menu li a").forEach(item => item.classList.remove("active"));
    activeButton.classList.add("active");
}

document.querySelectorAll(".menu li a").forEach(item => {
    item.addEventListener("click", function (event) {
        event.preventDefault();
        const url = this.getAttribute("href");

        if (url && url !== "#") {
            loadContent(url, this);
        }
    });
});