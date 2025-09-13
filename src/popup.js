
//Scan the current Page we are on
async function scanCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // =Send scan request to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });
    
    if (response && response.success) {
      updateScoreDisplay(response.data);
      return response.data;
    } else {
      throw new Error('Failed to scan page');
    }
  } catch (error) {
    console.error('Error scanning page:', error);
    showError('Unable to scan this page. Make sure you\'re on a valid website.');
    return null;
  }
}

//Update the counts in the popup display to show new counts
function updateScoreDisplay(scanResults) {
    //Safe count
  const safeElement = document.querySelector('.safe .score');
  //Meh Count
  const warningElement = document.querySelector('.warning .score');
  //Not safe COunt
  const dangerElement = document.querySelector('.danger .score');
  
  if (safeElement) safeElement.textContent = scanResults.safe;
  if (warningElement) warningElement.textContent = scanResults.warning;
  if (dangerElement) dangerElement.textContent = scanResults.danger;
  
  //Add a little jiggle to show it changed
  document.querySelectorAll('.score').forEach(score => {
    score.style.transform = 'scale(1.05)';
    setTimeout(() => {
      score.style.transform = 'scale(1)';
    }, 200);
  });
}

function showError(message) {
  const result = document.getElementById('result');
  if (result) {
    result.className = 'result-warning show';
    result.textContent = `Error: ${message}`;
  }
}
//assign on button click events on page load 
document.addEventListener('DOMContentLoaded', () => {
    //On scan button click

document.getElementById('scanBtn').addEventListener('click', async function() {
  const originalText = this.textContent;
  this.innerHTML = '<span class="spinner"></span>Scanning...';
  this.disabled = true;
  //Scan the page
  const results = await scanCurrentPage();
  
  this.textContent = originalText;
  this.disabled = false;
  
  if (results) {
    console.log('Scan results:', results);
  }
});})
