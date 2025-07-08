# Proje Yönetim Sistemi (PMS)

Proje Yönetim Sistemi (PMS), küçük ve orta ölçekli ekipler için geliştirilmiş, kullanıcı dostu bir web tabanlı proje ve görev yönetim uygulamasıdır. Kullanıcılar projelerini, görevlerini, personellerini ve destek taleplerini kolayca yönetebilir.

## Özellikler

- **Kullanıcı Kayıt & Giriş:** JWT tabanlı kimlik doğrulama ve oturum yönetimi.
- **Proje Yönetimi:** Proje oluşturma, mevcut ve geçmiş projeleri listeleme.
- **Görev Yönetimi:** Görev ekleme, listeleme, güncelleme ve silme.
- **Personel Yönetimi:** Personel ekleme, listeleme ve silme.
- **Departman Yönetimi:** Departman ekleme, listeleme ve silme.
- **Ajanda & Notlar:** Takvim üzerinde not ekleme, listeleme ve silme.
- **Firma Bilgileri:** Firma bilgilerini ekleme ve güncelleme.
- **Destek Talepleri:** Dosya ekleyerek destek talebi oluşturma ve takip.
- **Kullanıcı Ayarları:** Şifre ve e-posta güncelleme.
- **Rol Yönetimi:** Kullanıcı rolleri (Admin, Project Manager, Member).

## Kurulum

1. **Depoyu klonlayın:**
   ```sh
   git clone https://github.com/Doxa56/pms.git
   cd pms
   ```

2. **Bağımlılıkları yükleyin:**
   ```sh
   npm install
   ```

3. **Veritabanını oluşturun:**
   ```sh
   node javascript/database_setup.js
   ```

4. **Sunucuyu başlatın:**
   ```sh
   node javascript/server.js
   ```

5. **Uygulamayı açın:**
   - Tarayıcınızda `http://localhost:3000/login.html` adresine gidin.

## Kullanılan Teknolojiler

- **Backend:** Node.js, Express.js, SQLite3
- **Frontend:** HTML, CSS, JavaScript
- **Kimlik Doğrulama:** JWT, express-session, bcrypt
- **Dosya Yükleme:** Multer

## Klasör Yapısı

```
pms/
│
├── css/                # Stil dosyaları
├── html/               # HTML arayüz dosyaları
├── image/              # Görseller
├── javascript/         # Sunucu ve veritabanı dosyaları
│   ├── database_setup.js
│   ├── server.js
│   └── ...
├── uploads/            # Yüklenen dosyalar
├── package.json
└── project_management.db
```

## API Özet

- `/register` - Kullanıcı kaydı
- `/login` - Kullanıcı girişi
- `/create-project` - Proje oluşturma
- `/current-projects` - Aktif projeler
- `/past-projects` - Geçmiş projeler
- `/add-task` - Görev ekleme
- `/get-tasks` - Görevleri listeleme
- `/add-personnel` - Personel ekleme
- `/get-personnels` - Personelleri listeleme
- `/add-department` - Departman ekleme
- `/get-departments` - Departmanları listeleme
- `/add-support-request` - Destek talebi oluşturma
- `/get-support-requests` - Destek taleplerini listeleme
- `/add-note` - Ajandaya not ekleme
- `/get-notes` - Notları listeleme

## Katkı Sağlama

Katkıda bulunmak için lütfen bir fork oluşturun ve pull request gönderin.

## Lisans

Bu proje MIT lisansı ile lisanslanmıştır.
