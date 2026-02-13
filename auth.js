// auth.js - Firebase (Auth) Entegrasyonu - HATA ÇÖZÜLMÜŞ VERSİYON

// Global değişkenlerin varlığını garanti altına alalım
const getAuth = () => window.auth || firebase.auth();
const getDB = () => window.db || firebase.firestore();

const Auth = {
    // Giriş Yap
    login: async (email, password) => {
        const _auth = getAuth();
        const _db = getDB();
        try {
            const userCredential = await _auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const userDoc = await _db.collection("users").doc(user.uid).get();
            let userData = userDoc.data();

            if (!userData) {
                userData = {
                    uid: user.uid,
                    username: email.split('@')[0],
                    email: email,
                    role: 'user',
                    createdAt: new Date().toISOString()
                };
                await _db.collection("users").doc(user.uid).set(userData);
            }

            // IP Loglama
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                const ipData = await res.json();
                const newLog = { ip: ipData.ip, date: new Date().toISOString() };
                let ipHistory = userData.ipHistory || [];
                ipHistory.unshift(newLog);
                if (ipHistory.length > 50) ipHistory = ipHistory.slice(0, 50);
                await _db.collection("users").doc(user.uid).update({ ipHistory: ipHistory });
                userData.ipHistory = ipHistory;
            } catch (e) { console.log("IP alınamadı"); }

            localStorage.setItem('oa_current_user', JSON.stringify(userData));
            return { success: true, user: userData };
        } catch (error) {
            console.error("Login Error:", error);
            let message = "Giriş başarısız.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') message = "E-posta veya şifre hatalı.";
            return { success: false, message: message };
        }
    },

    // Kayıt Ol
    register: async (username, email, password, phone) => {
        const _auth = getAuth();
        const _db = getDB();
        try {
            const userCredential = await _auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            const newUser = {
                uid: user.uid,
                username: username,
                email: email,
                phone: phone,
                role: 'user',
                createdAt: new Date().toISOString()
            };

            await _db.collection("users").doc(user.uid).set(newUser);
            return { success: true, message: "Kayıt başarılı! Giriş yapabilirsiniz." };
        } catch (error) {
            let message = "Kayıt yapılamadı: " + error.message;
            if (error.code === 'auth/email-already-in-use') message = "Bu e-posta zaten kullanımda.";
            return { success: false, message: message };
        }
    },

    // Çıkış Yap
    logout: () => {
        const _auth = getAuth();
        _auth.signOut().finally(() => {
            localStorage.removeItem('oa_current_user');
            window.location.href = 'index.html';
        });
    },

    // Oturum Kontrolü
    checkAuth: () => {
        const _auth = getAuth();
        const _db = getDB();

        // First, try to show cached user data for instant UI update (no redirects)
        const cachedUser = Auth.getCurrentUser();
        if (cachedUser) {
            Auth.updateUI(cachedUser, true); // Show cached data but skip redirects
        } else {
            Auth.updateUI(null, true); // Show logged-out state but skip redirects
        }

        // Then verify with Firebase and allow redirects
        _auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const doc = await _db.collection("users").doc(firebaseUser.uid).get();
                if (doc.exists) {
                    const userData = doc.data();
                    localStorage.setItem('oa_current_user', JSON.stringify(userData));
                    Auth.updateUI(userData, false); // Update with fresh data and allow redirects
                } else {
                    // User document doesn't exist, clear cache and show logged out
                    localStorage.removeItem('oa_current_user');
                    Auth.updateUI(null, false); // Allow redirects now
                }
            } else {
                // Not logged in, clear any cached data
                localStorage.removeItem('oa_current_user');
                Auth.updateUI(null, false); // Allow redirects now
            }
        });
    },

    // Arayüzü Güncelle
    updateUI: (user, skipRedirect = false) => {
        const path = window.location.pathname;
        const isAdminPage = path.includes('admin.html');
        const isAuthPage = path.includes('login.html') || path.includes('register.html');

        const userDropdown = document.getElementById('user-dropdown');
        const authButtons = document.getElementById('auth-buttons');
        const dataStatus = document.querySelector('.data-status-wrapper');
        const mobileUserActions = document.getElementById('mobile-user-actions');
        const mobileAuthActions = document.getElementById('mobile-auth-actions');
        const mobileDataUpload = document.getElementById('mobile-data-upload');
        const adminBtn = document.getElementById('admin-btn');

        if (user) {
            // Logged In
            if (authButtons) authButtons.style.setProperty('display', 'none', 'important');
            if (mobileAuthActions) mobileAuthActions.style.setProperty('display', 'none', 'important');

            if (userDropdown) userDropdown.style.display = 'block';
            if (dataStatus) dataStatus.style.display = 'flex';
            if (mobileUserActions) mobileUserActions.style.display = 'flex';

            const mobileAdminBtn = document.getElementById('mobile-admin-btn');
            if (mobileAdminBtn) {
                mobileAdminBtn.style.setProperty('display', (user.role === 'admin') ? 'block' : 'none', 'important');
            }


            // Show mobile data upload for VIP/admin
            if (mobileDataUpload && (user.role === 'vip' || user.role === 'admin')) {
                mobileDataUpload.style.display = 'flex';
            }

            const nameDisplay = document.getElementById('username-display');
            if (nameDisplay) nameDisplay.textContent = user.username;

            const roleBadge = document.getElementById('role-badge');
            if (roleBadge) {
                roleBadge.style.display = 'inline-block';
                roleBadge.textContent = (user.role || 'USER').toUpperCase();
                roleBadge.className = 'badge ' + (user.role === 'admin' ? 'badge-admin' : (user.role === 'vip' ? 'badge-vip' : 'badge-user'));
            }

            if (adminBtn) adminBtn.style.display = (user.role === 'admin') ? 'block' : 'none';

            // Only redirect if not skipping redirects
            if (!skipRedirect) {
                if (isAdminPage && user.role !== 'admin') window.location.href = 'index.html';
                if (isAuthPage) window.location.href = 'index.html';
            }
        } else {
            // Logged Out - Explicitly hide all user-related elements
            if (authButtons) authButtons.style.setProperty('display', 'flex', 'important');
            if (mobileAuthActions) mobileAuthActions.style.setProperty('display', 'flex', 'important');

            if (userDropdown) userDropdown.style.setProperty('display', 'none', 'important');
            if (dataStatus) dataStatus.style.setProperty('display', 'none', 'important');
            if (mobileUserActions) mobileUserActions.style.setProperty('display', 'none', 'important');

            // Explicitly hide admin button when logged out
            // Explicitly hide admin button when logged out
            if (adminBtn) adminBtn.style.setProperty('display', 'none', 'important');
            const mobileAdminBtn = document.getElementById('mobile-admin-btn');
            if (mobileAdminBtn) mobileAdminBtn.style.setProperty('display', 'none', 'important');


            // Only redirect if not skipping redirects
            if (!skipRedirect) {
                if (isAdminPage || path.includes('profile.html')) window.location.href = 'login.html';
            }
        }

        // Index.html mesaj güncelleme
        const messageBox = document.querySelector('.glass-card p');
        if (messageBox && path.includes('index.html')) {
            if (user) {
                messageBox.innerHTML = (user.role === 'vip' || user.role === 'admin') ?
                    'Analizinizi yukarıdaki Analiz kısmından yapmaya başlayabilirsiniz.' :
                    'Vip almak için yukarıdaki VIP bölümüne gidiniz.';
            } else {
                messageBox.innerHTML = 'Lütfen önce hesap oluşturup giriş yapın.';
            }
        }
    },

    // Profil Güncelleme
    updateProfile: async (updates) => {
        const _auth = getAuth();
        const _db = getDB();
        const user = _auth.currentUser;

        if (!user) return { success: false, message: "Kullanıcı oturumu bulunamadı." };

        try {
            await _db.collection("users").doc(user.uid).update(updates);

            // Local storage güncelle
            const currentUserData = Auth.getCurrentUser();
            const newUserData = { ...currentUserData, ...updates };
            localStorage.setItem('oa_current_user', JSON.stringify(newUserData));

            // Update UI immediately
            Auth.updateUI(newUserData);

            return { success: true, message: "Profil güncellendi." };
        } catch (error) {
            console.error("Update Profile Error:", error);
            return { success: false, message: "Güncelleme başarısız." };
        }
    },

    // Şifre Güncelleme
    updatePassword: async (currentPassword, newPassword) => {
        const _auth = getAuth();
        const user = _auth.currentUser;

        if (!user) return { success: false, message: "Oturum bulunamadı." };

        try {
            // Re-authenticate
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
            await user.reauthenticateWithCredential(credential);

            // Update password
            await user.updatePassword(newPassword);
            return { success: true, message: "Şifre başarıyla değiştirildi." };
        } catch (error) {
            console.error("Password Update Error:", error);
            if (error.code === 'auth/wrong-password') return { success: false, message: "Mevcut şifre hatalı." };
            return { success: false, message: "Şifre değiştirilemedi: " + error.message };
        }
    },

    getCurrentUser: () => {
        const u = localStorage.getItem('oa_current_user');
        try { return u ? JSON.parse(u) : null; } catch (e) { return null; }
    },

    validateAccess: (targetUrl) => {
        // Check if the URL is a protected page
        const protectedPages = ['analysis.html', 'dedicated_analysis.html', 'analysis_select.html', 'opening_analysis.html'];
        const isProtected = protectedPages.some(page => targetUrl.includes(page));

        if (!isProtected) return { allowed: true };

        const user = Auth.getCurrentUser();
        if (!user) return { allowed: false, reason: 'guest', message: 'Analiz için giriş yapmalısınız.' };

        // Admin her zaman erişebilir
        if (user.role === 'admin') return { allowed: true };

        // VIP kontrolü: Hem rol hem de süre kontrolü
        if (user.role === 'vip') {
            if (user.vipExpiry && new Date(user.vipExpiry) > new Date()) {
                return { allowed: true };
            } else {
                return { allowed: false, reason: 'expired', message: 'VIP süreniz dolmuştur. Lütfen yenileyiniz.' };
            }
        }

        return { allowed: false, reason: 'not_vip', message: 'Bu özellik sadece VIP üyelere özeldir.' };
    },

    protectPage: () => {
        const result = Auth.validateAccess(window.location.pathname);
        if (!result.allowed) {
            alert(result.message);
            // Immediate redirect - don't allow any further execution
            window.location.replace(result.reason === 'guest' ? 'login.html' : 'vip.html');
            // Throw error to stop script execution
            throw new Error('Unauthorized access blocked');
        }
    }
};

const Visitor = {
    init: async () => {
        const _db = getDB();
        const STORAGE_KEY = 'oa_visitor_id';
        const LAST_VISIT_KEY = 'oa_last_visit_date';

        let visitorId = localStorage.getItem(STORAGE_KEY);
        const today = new Date().toISOString().split('T')[0];
        const lastVisitDate = localStorage.getItem(LAST_VISIT_KEY);

        // 1. Yeni Ziyaretçi Kontrolü
        if (!visitorId) {
            visitorId = 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem(STORAGE_KEY, visitorId);

            // Global toplamı artır
            try {
                await _db.collection('stats').doc('global').set({
                    total_visitors: firebase.firestore.FieldValue.increment(1)
                }, { merge: true });
            } catch (e) {
                console.error('Ziyaretçi sayılamadı:', e);
            }
        }

        // 2. Günlük Ziyaret Kontrolü
        if (lastVisitDate !== today) {
            localStorage.setItem(LAST_VISIT_KEY, today);

            // Günlük toplamı artır
            try {
                await _db.collection('daily_stats').doc(today).set({
                    count: firebase.firestore.FieldValue.increment(1),
                    date: today
                }, { merge: true });
            } catch (e) {
                console.error('Günlük sayaç hatası:', e);
            }
        }
    }
};

// Global erişim için window'a bağla
window.Auth = Auth;
window.Visitor = Visitor;

// Sayfa yüklendiğinde otomatik başlat
document.addEventListener('DOMContentLoaded', () => {
    Visitor.init(); // Ziyaretçi takibini başlat

    const path = window.location.pathname;
    // Protect pages BEFORE checking auth to prevent any access
    const protectedPages = ['analysis.html', 'dedicated_analysis.html', 'analysis_select.html', 'opening_analysis.html'];
    if (protectedPages.some(page => path.includes(page))) {
        Auth.protectPage();
    }

    Auth.checkAuth();

    // Link koruma
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        const result = Auth.validateAccess(href);
        if (!result.allowed) {
            e.preventDefault();
            alert(result.message);
            window.location.href = result.reason === 'guest' ? 'login.html' : 'vip.html';
        }
    });


});