const $=s=>document.querySelector(s);
let user=null,stream=null,photoBlob=null,coords=null;
const api=async(url,opts={})=>{const r=await fetch(url,opts);if(!r.ok){let d={};try{d=await r.json()}catch{}throw Error(d.error||"Terjadi kesalahan.")}return r};
const json=(url,body)=>api(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json());
function show(id){["loginView","employeeView","adminView"].forEach(x=>$("#"+x).classList.toggle("hidden",x!==id));$("#userbar").classList.toggle("hidden",!user)}
function message(el,text,ok=false){el.textContent=text;el.className="message "+(ok?"success":"")}
function localDate(){return new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Jakarta"})}
function fmt(value){if(!value)return "—";return new Date(value).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jakarta"})}
async function boot(){try{const cfg=await (await api("/api/config")).json();$("#company").textContent=cfg.company.toUpperCase();$("#footerCompany").textContent=cfg.company;document.title="Absensi - "+cfg.company;$("#year").textContent=new Date().getFullYear();const me=await (await api("/api/me")).json();if(me.user){user=me.user;await enter()}else show("loginView")}catch(e){show("loginView")}}
async function enter(){ $("#who").textContent=user.name; if(user.role==="admin"){show("adminView");await loadAdmin()}else{show("employeeView");$("#employeeName").textContent=user.name;$("#todayDate").textContent=new Date().toLocaleDateString("id-ID",{dateStyle:"full"});await loadEmployee()} }
$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();$("#loginError").textContent="";const data=Object.fromEntries(new FormData(e.target));try{const result=await json("/api/login",data);user=result.user;await enter()}catch(err){$("#loginError").textContent=err.message}});
$("#logout").onclick=async()=>{if(stream)stream.getTracks().forEach(t=>t.stop());await api("/api/logout",{method:"POST"});user=null;photoBlob=null;coords=null;show("loginView")};
async function loadEmployee(){const d=await (await api("/api/my-attendance")).json();const a=d.today;$("#todayStatus").textContent=a?.check_out?"Selesai":a?.check_in?"Sudah masuk":"Belum absen";$("#checkInTime").textContent=fmt(a?.check_in);$("#checkOutTime").textContent=fmt(a?.check_out);$("#checkIn").disabled=!!a?.check_in;$("#checkOut").disabled=!a?.check_in||!!a?.check_out;$("#history").innerHTML=d.rows.length?d.rows.map(x=>`<div class="history-item"><div><b>${new Date(x.date+"T00:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</b><small>Masuk ${fmt(x.check_in)} · Pulang ${fmt(x.check_out)}</small></div><span class="pill">${x.check_out?"Selesai":x.check_in?"Hadir":"—"}</span></div>`).join(""):'<p class="muted">Belum ada riwayat absensi.</p>'}
$("#startCamera").onclick=async()=>{try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});$("#video").srcObject=stream;$("#video").classList.remove("hidden");$("#preview").classList.add("hidden");$("#cameraPlaceholder").classList.add("hidden");$("#takePhoto").disabled=false;locate()}catch(e){message($("#attendanceMessage"),"Kamera tidak dapat diakses. Periksa izin browser dan gunakan HTTPS atau localhost.")}};
function locate(){if(!navigator.geolocation){$("#locationText").textContent="GPS tidak didukung browser.";return}navigator.geolocation.getCurrentPosition(p=>{coords={latitude:p.coords.latitude,longitude:p.coords.longitude};$("#locationText").textContent=`✓ GPS siap · ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`},()=>{$("#locationText").textContent="GPS belum diizinkan. Aktifkan izin lokasi.";coords=null},{enableHighAccuracy:true,timeout:12000})}
$("#takePhoto").onclick=()=>{const v=$("#video"),c=$("#canvas");if(!v.videoWidth)return; c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);c.toBlob(blob=>{photoBlob=blob;$("#preview").src=URL.createObjectURL(blob);$("#preview").classList.remove("hidden");v.classList.add("hidden");$("#takePhoto").disabled=true;$("#retake").disabled=false;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}, "image/jpeg",.85)};
$("#retake").onclick=()=>{$("#preview").classList.add("hidden");$("#cameraPlaceholder").classList.remove("hidden");photoBlob=null;$("#takePhoto").disabled=true;$("#retake").disabled=true};
async function submitAttendance(action){if(!photoBlob)return message($("#attendanceMessage"),"Ambil foto selfie terlebih dahulu.");if(!coords){locate();return message($("#attendanceMessage"),"Lokasi GPS wajib diaktifkan. Coba lagi setelah GPS siap.")}const fd=new FormData();fd.append("selfie",photoBlob,"selfie.jpg");fd.append("latitude",coords.latitude);fd.append("longitude",coords.longitude);try{const r=await api("/api/attendance/"+action,{method:"POST",body:fd});const d=await r.json();message($("#attendanceMessage"),d.message,true);photoBlob=null;$("#preview").classList.add("hidden");$("#cameraPlaceholder").classList.remove("hidden");$("#retake").disabled=true;await loadEmployee()}catch(e){message($("#attendanceMessage"),e.message)}}
$("#checkIn").onclick=()=>submitAttendance("in");$("#checkOut").onclick=()=>submitAttendance("out");
async function loadAdmin(){const s=await (await api("/api/admin/summary")).json();$("#adminDate").textContent=new Date().toLocaleDateString("id-ID",{dateStyle:"full"});$("#totalEmployees").textContent=s.total;$("#presentCount").textContent=s.hadir;$("#absentCount").textContent=s.belum;$("#outCount").textContent=s.pulang;$("#dateFrom").value=localDate().slice(0,8)+"01";$("#dateTo").value=localDate();await loadRows();await loadStaff()}
async function loadRows(){const q=new URLSearchParams({from:$("#dateFrom").value,to:$("#dateTo").value});const d=await (await api("/api/admin/attendance?"+q)).json();$("#attendanceRows").innerHTML=d.rows.length?d.rows.map(x=>`<tr><td>${x.date}</td><td><b>${esc(x.name)}</b><br><small>${esc(x.email)}</small></td><td>${esc(x.department||"—")}</td><td>${fmt(x.check_in)}</td><td>${fmt(x.check_out)}</td><td><span class="status-tag">${x.check_out?"Selesai":"Hadir"}</span></td><td>${x.check_in_lat?`${Number(x.check_in_lat).toFixed(4)}, ${Number(x.check_in_lng).toFixed(4)}`:"—"}</td></tr>`).join(""):'<tr><td colspan="7">Belum ada data pada rentang tanggal ini.</td></tr>'}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function loadStaff(){const d=await (await api("/api/admin/users")).json();$("#staffList").innerHTML=d.users.length?d.users.map(u=>`<div class="staff-item"><div><b>${esc(u.name)}</b><small>${esc(u.email)} · ${esc(u.department||"Tanpa departemen")}</small></div><span>#${u.id}</span></div>`).join(""):'<p class="muted">Belum ada karyawan.</p>'}
$("#filterBtn").onclick=loadRows;
$("#exportBtn").onclick=()=>{const q=new URLSearchParams({from:$("#dateFrom").value,to:$("#dateTo").value});location.href="/api/admin/export?"+q};
$("#addUserForm").onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await json("/api/admin/users",data);message($("#userMessage"),"Karyawan berhasil ditambahkan.",true);e.target.reset();await loadStaff();await loadAdmin()}catch(err){message($("#userMessage"),err.message)}};
boot();
// PWA: pasang aplikasi dari browser yang mendukung instalasi.
let installPrompt = null;
const installButtons = [$("#installApp"), $("#installAppGuest")].filter(Boolean);
function updateInstallButtons(show) {
  installButtons.forEach(btn => btn.classList.toggle("hidden", !show));
}
updateInstallButtons(true);
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  updateInstallButtons(true);
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  updateInstallButtons(false);
});
async function installPWA() {
  if (installPrompt) {
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    updateInstallButtons(false);
  } else {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const help = $("#installHelp");
    help.classList.remove("hidden");
    help.textContent = isIOS
      ? 'Untuk memasang di iPhone: tekan tombol Bagikan di Safari, lalu pilih "Add to Home Screen / Tambahkan ke Layar Utama".'
      : 'Jika tombol pemasangan belum muncul, buka menu browser (⋮), lalu pilih "Install app" atau "Tambahkan ke layar utama".';
  }
}
installButtons.forEach(btn => btn.addEventListener("click", installPWA));
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(err => console.warn("Service worker:", err)));
}
