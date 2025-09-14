//This is the js file for popup.html aka the popup for the extension

//Create a list of demo questions to ask the user so they can level
const quizQuestions = [
  {
    question: "What is phishing?",
    options: [
      "A type of fishing technique",
      "Fraudulent attempts to obtain sensitive information by pretending to be trustworthy",
      "A computer virus that damages files",
      "A method to speed up internet connection"
    ],
    correct: 1,
    explanation: "Phishing is a cybercrime where attackers impersonate legitimate organizations to steal sensitive data like passwords and credit card numbers."
  },
  {
    question: "Which of these URLs is most likely to be suspicious?",
    options: [
      "https://www.amazon.com/products",
      "http://g00gle-security-check.tk/verify",
      "https://github.com/user/project",
      "https://www.microsoft.com/support"
    ],
    correct: 1,
    explanation: "The suspicious URL uses a deceptive domain (g00gle instead of google), HTTP instead of HTTPS, and a suspicious TLD (.tk)."
  },
  {
    question: "What should you do if you receive an urgent email asking for your password?",
    options: [
      "Reply immediately with your password",
      "Click the link and enter your credentials",
      "Ignore the email and verify independently",
      "Forward it to all your contacts"
    ],
    correct: 2,
    explanation: "Legitimate organizations never ask for passwords via email. Always verify such requests through official channels."
  },
  {
    question: "What is a strong indicator of a secure website?",
    options: [
      "Lots of colorful graphics",
      "HTTPS protocol and valid SSL certificate",
      "Pop-up advertisements",
      "Requests for personal information immediately"
    ],
    correct: 1,
    explanation: "HTTPS encryption and valid SSL certificates ensure your data is transmitted securely between your browser and the website."
  },
  {
    question: "What is social engineering in cybersecurity?",
    options: [
      "Building social networks online",
      "Manipulating people to divulge confidential information",
      "Engineering social media platforms",
      "Creating user-friendly interfaces"
    ],
    correct: 1,
    explanation: "Social engineering exploits human psychology rather than technical vulnerabilities to gain access to systems or information."
  },
  {
    question: "Which file extension should you be most cautious of?",
    options: [
      ".txt",
      ".jpg",
      ".exe",
      ".pdf"
    ],
    correct: 2,
    explanation: ".exe files are executable programs that can potentially contain malware. Always scan them before running."
  },
  {
    question: "What does two-factor authentication (2FA) provide?",
    options: [
      "Faster login speed",
      "Better password suggestions",
      "An additional layer of security",
      "Automatic password reset"
    ],
    correct: 2,
    explanation: "2FA adds an extra verification step beyond just your password, making accounts much more secure."
  },
  {
    question: "What should you check before entering sensitive information on a website?",
    options: [
      "The website's color scheme",
      "The URL and SSL certificate",
      "The number of images on the page",
      "The website's loading speed"
    ],
    correct: 1,
    explanation: "Always verify the URL is correct and look for the padlock icon indicating a secure HTTPS connection."
  }
];

// #region user scoring system

class UserScoreManager {
  constructor() {
    this.score = 0;
    this.loadScore();
  }

  //;load  the users score from chrome storage
  async loadScore() {
    try {
        //get the score of the user
      const result = await chrome.storage.local.get(['userScore']);
      //check whether the user does in fact have a score 
      this.score = result.userScore || 0;

      //Todo:Remove ,testing purpises
      console.log('Loaded user score:', this.score);
    } catch (error) {

      console.error('Error loading score:', error);
      this.score = 0;
    }
  }

  //Save the users score
  async saveScore() {
    try {
        //Set the users new score in storage
      await chrome.storage.local.set({ userScore: this.score });
      //Todo: remove ,tesing
      console.log('Saved user score:', this.score);
    } catch (error) {
      console.error('Error saving score:', error);
    }
  }

  //Add points when the user answers correcntly 
  async addPoints(points) {
    this.score += points;
    await this.saveScore();
    return this.score;
  }
//get the users scorew
  getScore() {
    return this.score;
  }
}
//Inisitialix the scoring
const scoreManager = new UserScoreManager();
//#endregion


//#region Quiz stuff

//show the quiz modal
//recreate a "modal" with the main conentn and overlay 
function showQuizModal() {
  return new Promise((resolve) => {
    // check for exsisting 
    const existingModal = document.querySelector('.quiz-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    //get rand question from list above
    const question = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    
    //create overlayu
    const overlay = document.createElement('div');
    overlay.className = 'quiz-modal-overlay';
    
    //create content
    const modal = document.createElement('div');
    modal.className = 'quiz-modal';
    
    //add the modals content
    modal.innerHTML = `
      <div class="quiz-header">
        <h2>🧠 Security Quiz</h2>
        <div class="quiz-score">Score: ${scoreManager.getScore()}</div>
        <button class="quiz-close-btn">&times;</button>
      </div>
      
      <div class="quiz-content">
        <div class="quiz-question">
          <p><strong>Question:</strong> ${question.question}</p>
        </div>
        
        <div class="quiz-options">
          ${question.options.map((option, index) => `
            <button class="quiz-option" data-index="${index}">
              <span class="option-letter">${String.fromCharCode(65 + index)}</span>
              <span class="option-text">${option}</span>
            </button>
          `).join('')}
        </div>
        
        <div class="quiz-result" style="display: none;">
          <div class="result-message"></div>
          <div class="result-explanation"></div>
          <button class="quiz-next-btn">Next Question</button>
        </div>
      </div>
    `;
   //add contentto overlay 
    overlay.appendChild(modal);
    //add overlay to body to show
    document.body.appendChild(overlay);
    
    //add listeneres for:
    //close modal
    const closeBtn = modal.querySelector('.quiz-close-btn');
    //options for answers
    const optionBtns = modal.querySelectorAll('.quiz-option');
    //where the correct answer will display 
    const resultDiv = modal.querySelector('.quiz-result');
    //the message within the resultDiv that say swhether the user got it correct or ot 
    const messageDiv = modal.querySelector('.result-message');
    //Also in the resultDiv , gives the explanation
    const explanationDiv = modal.querySelector('.result-explanation');
    //Button tat takes the user to the next uestion 
    const nextBtn = modal.querySelector('.quiz-next-btn');
    
    //close the "modal"
    const closeModal = () => {
      overlay.remove();
      resolve();
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    //add event listener to each option within the "modal"
    optionBtns.forEach((btn, index) => {
      btn.addEventListener('click', async () => {
        //when one is sellcet disabled the rest of the buttons
        optionBtns.forEach(optBtn => {
          optBtn.disabled = true;
          optBtn.style.cursor = 'not-allowed';
        });
        
        const isCorrect = index === question.correct;
        
        //add styling to each of the options whether it was the correct or incorrect oopyion 
        optionBtns.forEach((optBtn, optIndex) => {
          if (optIndex === question.correct) {
            optBtn.classList.add('correct');
          } else if (optIndex === index && !isCorrect) {
            optBtn.classList.add('incorrect');
          } else {
            optBtn.classList.add('disabled');
          }
        });
        
        //add result things to the result div ,aka the mxplanation and whther the user was right or not
        if (isCorrect) {
            //add score to chrome.storage
          const newScore = await scoreManager.addPoints(10);
          messageDiv.innerHTML = `
            <div style="color: #2e7d32; font-weight: bold;">
              ✅ Correct! +10 points
            </div>
            <div style="margin-top: 8px;">Total Score: ${newScore}</div>
          `;
          
          // update score at the top of the "modal"
          modal.querySelector('.quiz-score').textContent = `Score: ${newScore}`;
        } else {

            //User was incorrect 
          messageDiv.innerHTML = `
            <div style="color: #d32f2f; font-weight: bold;">
              ❌ Incorrect. Better luck next time!
            </div>
            <div style="margin-top: 8px;">Score: ${scoreManager.getScore()}</div>
          `;
        }
        //Add explanation as to why the user was incorrect 
        explanationDiv.innerHTML = `
          <div style="margin-top: 12px; padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 14px; line-height: 1.4;">
            <strong>Explanation:</strong> ${question.explanation}
          </div>
        `;
        //Show result block
        resultDiv.style.display = 'block';
      });
    });
    
    //add listener to go to next question 
    nextBtn.addEventListener('click', () => {
      closeModal();
      //show nect question 
      setTimeout(() => showQuizModal(), 200);
    });
    
    //add style for the modal
    //Todo: add in popupcss
    if (!document.getElementById('quiz-modal-styles')) {
      const styles = document.createElement('style');
      styles.id = 'quiz-modal-styles';
      styles.textContent = `
        .quiz-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
        }
        
        .quiz-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease;
        }
        
        .quiz-header {
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px 12px 0 0;
        }
        
        .quiz-header h2 {
          margin: 0;
          font-size: 24px;
        }
        
        .quiz-score {
          font-weight: bold;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          font-size: 14px;
        }
        
        .quiz-close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .quiz-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .quiz-content {
          padding: 24px;
        }
        
        .quiz-question {
          margin-bottom: 24px;
        }
        
        .quiz-question p {
          font-size: 18px;
          line-height: 1.5;
          margin: 0;
        }
        
        .quiz-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        
        .quiz-option {
          display: flex;
          align-items: center;
          padding: 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          font-size: 16px;
        }
        
        .quiz-option:hover:not(:disabled) {
          border-color: #667eea;
          background: #f8f9ff;
        }
        
        .option-letter {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: #667eea;
          color: white;
          border-radius: 50%;
          font-weight: bold;
          margin-right: 12px;
          font-size: 14px;
        }
        
        .option-text {
          flex: 1;
          line-height: 1.4;
        }
        
        .quiz-option.correct {
          border-color: #2e7d32;
          background: #e8f5e8;
        }
        
        .quiz-option.correct .option-letter {
          background: #2e7d32;
        }
        
        .quiz-option.incorrect {
          border-color: #d32f2f;
          background: #ffebee;
        }
        
        .quiz-option.incorrect .option-letter {
          background: #d32f2f;
        }
        
        .quiz-option.disabled {
          opacity: 0.6;
        }
        
        .quiz-result {
          border-top: 1px solid #eee;
          padding-top: 20px;
          margin-top: 20px;
        }
        
        .result-message {
          font-size: 18px;
          text-align: center;
          margin-bottom: 16px;
        }
        
        .quiz-next-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 16px;
          transition: transform 0.2s ease;
        }
        
        .quiz-next-btn:hover {
          transform: translateY(-2px);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(styles);
    }
  });
}

//#endregion

//#region Credebility score for url check
function calculateCredibilityScore(linkData) {
  let score = 100; //not guilty until proven otherwise
  
  //add for both heuristics and api
  if (linkData.analysis) {
    const heuristicScore = linkData.analysis.heuristicScore || 0;
    const apiScore = linkData.analysis.apiScore || 0;
    
    //Add wieghts to both as api score is more credible than heuristics
    score -= (heuristicScore * 10); //Good indicator
    score -= (apiScore * 15); //but alot more serious 
  }
  
  //check https
  if (linkData.url.startsWith('http://')) score -= 10; 
  //check punycode
  if (linkData.domain && linkData.domain.includes('xn--')) score -= 20; 
  
  //check score is valid
  return Math.max(0, Math.min(100, score));
}

//Url check
function displayUrlAnalysis(linkData) {
    //get the score
  const credScore = calculateCredibilityScore(linkData);
  //get risklevel based on score
  const riskLevel = linkData.riskLevel || 'unknown';
  
  let scoreColor = '#2e7d32'; //not guilty until proven else
  let scoreText = 'Excellent';
  
  if (credScore < 30) {
    scoreColor = '#d32f2f'; //Danger -  Horribleeee score
    scoreText = 'Poor';
  } else if (credScore < 60) {
    scoreColor = '#f57c00'; //Warnign - meh score
    scoreText = 'Fair';
  } else if (credScore < 80) {
    scoreColor = '#fbc02d'; // Good -  not the best but not bad
    scoreText = 'Good';
  }
  
  //get dicv to show reslut in 
  const result = document.getElementById('result');

  //If the div exsists then show
  if (result) {
    result.className = 'result-analysis show ';
    result.style.display = "block";
    result.innerHTML = `
      <div class="analysis-container">
        <div class="credibility-score">
          <div class="score-circle" style="border-color: ${scoreColor};">
            <span class="score-number" style="color: ${scoreColor};">${credScore}</span>
            <span class="score-label">Credibility</span>
          </div>
          <div class="score-description">
            <div style="color: ${scoreColor}; font-weight: bold;">${scoreText}</div>
            <div style="font-size: 12px; color: #666;">Risk Level: ${riskLevel.toUpperCase()}</div>
          </div>
        </div>
        
        <div class="analysis-details">
          <div class="detail-item">
            <span class="detail-label">Domain:</span>
            <span class="detail-value">${linkData.domain || 'Unknown'}</span>
          </div>
          
          ${linkData.analysis ? `
            <div class="detail-item">
              <span class="detail-label">Security Checks:</span>
              <span class="detail-value">${linkData.analysis.apiScore > 0 ? 'Issues Found' : 'Passed'}</span>
            </div>
          ` : ''}
          
          <div class="detail-item">
            <span class="detail-label">Protocol:</span>
            <span class="detail-value ${linkData.url.startsWith('https://') ? 'secure' : 'insecure'}">
              ${linkData.url.startsWith('https://') ? 'HTTPS (Secure)' : 'HTTP (Not Secure)'}
            </span>
          </div>
        </div>
        
        <div class="recommendation">
          ${credScore >= 70 ? 
            '✅ This URL appears to be safe to visit.' :
            credScore >= 40 ?
            '⚠️ Exercise caution when visiting this URL.' :
            '🚨 We recommend avoiding this URL due to security concerns.'
          }
        </div>
      </div>
    `;
  }
  
  //add analys sttylew
  if (!document.getElementById('analysis-styles')) {
    const styles = document.createElement('style');
    styles.id = 'analysis-styles';
    styles.textContent = `
      .result-analysis {
        margin-top: 16px;
        padding: 0;
        border-radius: 12px;
        background: white;
        border: 1px solid #e0e0e0;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
      }
      
      .analysis-container {
        padding: 20px;
      }
      
      .credibility-score {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f0f0f0;
      }
      
      .score-circle {
        width: 80px;
        height: 80px;
        border: 4px solid;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      
      .score-number {
        font-size: 24px;
        font-weight: bold;
        line-height: 1;
      }
      
      .score-label {
        font-size: 10px;
        text-transform: uppercase;
        color: #666;
        margin-top: 2px;
      }
      
      .score-description div:first-child {
        font-size: 18px;
        margin-bottom: 4px;
      }
      
      .analysis-details {
        margin-bottom: 16px;
      }
      
      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #f8f8f8;
      }
      
      .detail-item:last-child {
        border-bottom: none;
      }
      
      .detail-label {
        font-weight: 500;
        color: #555;
        font-size: 14px;
      }
      
      .detail-value {
        font-size: 14px;
        color: #333;
      }
      
      .detail-value.secure {
        color: #2e7d32;
      }
      
      .detail-value.insecure {
        color: #d32f2f;
      }
      
      .recommendation {
        padding: 12px;
        border-radius: 8px;
        background: #f8f9fa;
        border-left: 4px solid #667eea;
        font-size: 14px;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(styles);
  }
}
//#endregion

//#region Rescan button
//rescan the page currently on 
async function scanCurrentPage() {
  try {
    //Todo: remove ,testing
    console.log('Starting page scan...');
    
    //get tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    //check if tab accesible
    if (!tab || !tab.id) {
      throw new Error('Cannot access current tab');
    }

    //Todo: eremove testing 
    console.log('Sending scan message to tab:', tab.id);

    //add content.js if not added already 
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('Content script injected successfully');
    } catch (injectionError) {
      console.log('Content script may already be loaded:', injectionError.message);
    }

    //send scan request to content.js
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Scan request timed out after 10 seconds'));
      }, 10000);
      //send request
      chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (response) => {
        clearTimeout(timeout);
        
        //check what happemed
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response) {
          console.log('Received response:', response);
          resolve(response);
        } else {
          reject(new Error('No response from content script'));
        }
      });
    });
    
    //if it worked
    if (response && response.success) {
        //update the score display
      updateScoreDisplay(response.data);
      console.log('Scan completed successfully:', response.data);
      return response.data;
    } else {
      throw new Error(response?.error || 'Failed to scan page');
    }
  } catch (error) {
    console.error('Error scanning page:', error);
    
    //if all else fails, show what happened
    let errorMessage = 'Unable to scan this page.';
    
    if (error.message.includes('Cannot access current tab')) {
      errorMessage = 'Cannot access the current tab. Try refreshing the page.';
    } else if (error.message.includes('Could not establish connection')) {
      errorMessage = 'Content script not loaded. Please refresh the page and try again.';
    } else if (error.message.includes('Extension context invalidated')) {
      errorMessage = 'Extension was updated. Please refresh the page.';
    } else if (error.message.includes('timed out')) {
      errorMessage = 'Scan timed out. The page may be too complex or unresponsive.';
    }
    
    showError(errorMessage);
    return null;
  }
}

//function to update counts in popup
function updateScoreDisplay(scanResults) {
  console.log('Updating display with results:', scanResults);
  
  //get counts 
  const safeScore = document.querySelector('.score.safe .count');
  const warningScore = document.querySelector('.score.warning .count ');
  const dangerScore = document.querySelector('.score.danger .count ');
  
  // update said counts
  if (safeScore) {
    //check valid score or default 0 
    safeScore.textContent = scanResults.safe || 0;
    console.log('Updated safe score to:', scanResults.safe || 0);
  } else {
    console.warn('Could not find safe score element');
  }
  
  if (warningScore) {
      //check valid score or default 0 
    warningScore.textContent = scanResults.warning || 0;
    console.log('Updated warning score to:', scanResults.warning || 0);
  } else {
    console.warn('Could not find warning score element');
  }
  
  if (dangerScore) {
      //check valid score or default 0 
    dangerScore.textContent = scanResults.danger || 0;
    console.log('Updated danger score to:', scanResults.danger || 0);
  } else {
    console.warn('Could not find danger score element');
  }
  
  //add little jiggle to show it updated
  document.querySelectorAll('.score').forEach(scoreElement => {
    scoreElement.style.transform = 'scale(1.05)';
    scoreElement.style.transition = 'transform 0.2s ease';
    
    setTimeout(() => {
      scoreElement.style.transform = 'scale(1)';
    }, 200);
  });

  //show total 
  const total = (scanResults.safe || 0) + (scanResults.warning || 0) + (scanResults.danger || 0);
  console.log(`Scan results - Safe: ${scanResults.safe}, Warning: ${scanResults.warning}, Danger: ${scanResults.danger}, Total: ${total}`);
  
  //update total amount 
  //Todo: not currently shown on pupup
  const totalDisplay = document.querySelector('.total-links');
  if (totalDisplay) {
    totalDisplay.textContent = `Total links found: ${total}`;
  }
}

//show error in result div if failed
function showError(message) {
  console.error('Showing error:', message);
  const result = document.getElementById('result');
  if (result) {
    result.className = 'result-warning show';
    result.innerHTML = `<span style="color: #d32f2f;">Error: ${message}</span>`;
    
    // Clear error after 8 seconds
    setTimeout(() => {
      result.className = '';
      result.innerHTML = '';
    }, 8000);
  } else {
    console.warn('Result element not found for error display');
  }
}

//show it worked
function showSuccess(message) {
  console.log('Showing success:', message);
  const result = document.getElementById('result');
  if (result) {
    result.className = 'result-success show';
    result.innerHTML = `<span style="color: #2e7d32;">${message}</span>`;
    
    // Clear success message after 4 seconds
    setTimeout(() => {
      result.className = '';
      result.innerHTML = '';
    }, 4000);
  }
}

//check if content.js is there
async function checkContentScriptLoaded(tabId) {
  try {
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Content script check timed out'));
      }, 2000);
      //send ping
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error('Content script not loaded'));
        } else {
          resolve(true);
        }
      });
    });
    return true;
  } catch (error) {
    return false;
  }
}

//analyze the url
async function analyzeUrl(url) {
  try {
    //Todo: show if url isnt valid
    //check if url entered exsists
    if (!url || !url.trim()) {
      throw new Error('Please enter a URL to analyze');
    }

    //validate
    if (!url.match(/^https?:\/\/.+/)) {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
    }

     //check if url entered is valid
    try {
      new URL(url);
    } catch (e) {
      throw new Error('Please enter a valid URL');
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    //send to content.js to analazye
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('URL analysis timed out'));
      }, 8000);

      chrome.tabs.sendMessage(tab.id, { 
        action: 'analyzeUrl', 
        url: url 
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (response && response.success) {
      //show results
      displayUrlAnalysis(response.data);
      console.log('URL analysis completed:', response.data);
      return response.data;
    } else {
      throw new Error(response?.error || 'Failed to analyze URL');
    }
  } catch (error) {
    console.error('Error analyzing URL:', error);
    showError(error.message);
    return null;
  }
}

//create popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Web Patronus popup loaded');

  //create score manager
  await scoreManager.loadScore();

  //check tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('Current tab:', tab);

  //check if tab is accesible
  if (!tab || !tab.id) {
    showError('Cannot access current tab. Please refresh the page.');
    return;
  }

  //check if content.js is there
  const contentScriptLoaded = await checkContentScriptLoaded(tab.id);
  console.log('Content script loaded:', contentScriptLoaded);

  //do a scan of the whole page
  try {
    showSuccess('Initializing scan...');
    const results = await scanCurrentPage();
    if (results) {
      showSuccess(`Initial scan found ${results.total || 0} links.`);
    }
  } catch (error) {
    console.error('Initial scan failed:', error);
  }

  // add listener to on rescan button click
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) {
    console.log('Setting up scan button listener');
    
    scanBtn.addEventListener('click', async function(event) {
      event.preventDefault();
      console.log('Scan button clicked!');
      
      const originalText = this.textContent;
      
      //show the scan is loading
      this.innerHTML = '<span class="spinner"></span>Scanning...';
      this.disabled = true;
      this.style.opacity = '0.7';
      this.style.cursor = 'not-allowed';
      
      try {
        console.log('Starting scan from button click...');
        //do scan
        const results = await scanCurrentPage();
        
        //add resukts
        if (results) {
          const total = results.total || 0;
          const safe = results.safe || 0;
          const warning = results.warning || 0;
          const danger = results.danger || 0;
          
          showSuccess(`Scan completed! Found ${total} links (Safe: ${safe}, Warning: ${warning}, Danger: ${danger}).`);
          console.log('Scan successful from button click');
        } else {
          showError('Scan completed but no results returned.');
        }
      } catch (error) {
        console.error('Scan button error:', error);
        showError('Scan failed: ' + error.message);
      } finally {
        // Restore button state
        console.log('Restoring button state');
        this.textContent = originalText;
        this.disabled = false;
        this.style.opacity = '1';
        this.style.cursor = 'pointer';
      }
    });
    
    console.log('Scan button listener added successfully');
  } else {
    console.error('Scan button not found!');
  }

  // add event listeners for button and url check block
  const checkBtn = document.getElementById('checkBtn');
  const urlInput = document.getElementById('urlInput');
  
  if (checkBtn && urlInput) {
    console.log('Setting up URL check button listener');
    
    //check url btn onclick event
    checkBtn.addEventListener('click', async function(event) {
      event.preventDefault();
      console.log('Check button clicked!');
      
      const url = urlInput.value.trim();
      if (!url) {
        showError('Please enter a URL to analyze');
        return;
      }
      
      const originalText = this.textContent;
      
      //load
      this.innerHTML = '<span class="spinner"></span>Checking...';
      this.disabled = true;
      this.style.opacity = '0.7';
      this.style.cursor = 'not-allowed';
      
      try {
        console.log('Analyzing URL:', url);
        await analyzeUrl(url);
        console.log('URL analysis completed');
      } catch (error) {
        console.error('Check button error:', error);
        showError('Failed to analyze URL: ' + error.message);
      } finally {
        //restor button to original
        this.textContent = originalText;
        this.disabled = false;
        this.style.opacity = '1';
        this.style.cursor = 'pointer';
      }
    });

    //allow enter on text box to enter 
    urlInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !checkBtn.disabled) {
        e.preventDefault();
        checkBtn.click();
      }
    });
    
    console.log('URL check button listener added successfully');
  } else {
    console.error('Check button or URL input not found!');
  }

  //listener for quix button 
  const quizBtn = document.getElementById('quizBtn');
  if (quizBtn) {
    console.log('Setting up quiz button listener');
    
    quizBtn.addEventListener('click', async function(event) {
      event.preventDefault();
      console.log('Quiz button clicked!');
      
      try {
        await showQuizModal();
      } catch (error) {
        console.error('Quiz error:', error);
        showError('Failed to load quiz');
      }
    });
    
    console.log('Quiz button listener added successfully');
  } else {
    console.error('Quiz button not found!');
  }

  // Add keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    
    
    //esc to close popup
    if (e.key === 'Escape') {
      window.close();
    }
  });

  console.log('Popup initialization completed');
});


if (chrome.runtime) {
  chrome.runtime.onConnect.addListener(() => {
    console.log('Extension context connected');
  });
}

//handle error
window.addEventListener('error', (e) => {
  console.error('Popup error:', e);
  showError('An unexpected error occurred. Try refreshing the page.');
});

//add spinnet styles
//Todo: add to pop.css? 
if (!document.getElementById('spinner-style')) {
  const style = document.createElement('style');
  style.id = 'spinner-style';
  style.textContent = `
    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #333;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 5px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .result-warning, .result-success {
      margin-top: 10px;
      padding: 8px;
      border-radius: 4px;
      transition: opacity 0.3s ease;
      font-size: 14px;
    }
    
    .result-warning {
      background-color: #fff3cd;
      border: 1px solid #ffeeba;
    }
    
    .result-success {
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
    }
    
    .show {
      opacity: 1;
    }
    
    button:disabled {
      cursor: not-allowed !important;
    }
  `;
  document.head.appendChild(style);
}