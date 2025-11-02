// replace these URLs with your Google Apps Script Web App URLs
const CLOCK_URL = 'https://script.google.com/macros/s/AKfycby8Gfc3JhMfTl4U6QSp81FnTGNRxksL17dSzsxY0OJz3qBpTbQONpevulpat7HFI6G-/exec';
const LEAVE_URL = 'https://script.google.com/a/macros/chinabazar.com/s/AKfycbwfXrkiHZNZBeQyCFYLKPYEtXJZWls89g2sHA-7FJR54reSoMrKhrxCHn0MEdTx-kSX/exec';

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.getElementById(tab).style.display = 'block';
}

// Handle Clock Form
document.getElementById('clockForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  fetch(CLOCK_URL, { method: 'POST', body: new FormData(form) })
    .then(() => {
      document.getElementById('clockResponse').textContent = 'Clock record saved ✅';
      form.reset();
    })
    .catch(() => alert('Error submitting'));
});

// Handle Leave Form
document.getElementById('leaveForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  fetch(LEAVE_URL, { method: 'POST', body: new FormData(form) })
    .then(() => {
      document.getElementById('leaveResponse').textContent = 'Leave submitted ✅';
      form.reset();
    })
    .catch(() => alert('Error submitting'));
});