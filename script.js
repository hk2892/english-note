// 상태 관리
let folders = JSON.parse(localStorage.getItem('folders')) || [];
let currentFolderId = null;
let currentPageIndex = 0;
let activeTab = 'word'; // 'word' 또는 'idiom'
let currentQuizList = [];
let quizIndex = 0;
let quizWrongs = [];

// DOM 요소
const viewMain = document.getElementById('view-main');
const viewViewer = document.getElementById('view-viewer');
const viewQuiz = document.getElementById('view-quiz');
const folderGrid = document.getElementById('folder-grid');

// 이벤트 리스너 - 초기화
document.addEventListener('DOMContentLoaded', () => {
  renderFolders();

  // 폴더 생성 모달
  document.getElementById('btn-add-folder').onclick = () => showModal('modal-folder');
  document.getElementById('btn-cancel-folder').onclick = () => closeModal('modal-folder');
  document.getElementById('btn-confirm-folder').onclick = createFolder;

  // 메인 이동
  document.getElementById('btn-back-main').onclick = () => {
    switchView('view-main');
    saveData();
  };

  // 본문 입력/수정
  document.getElementById('btn-edit-text').onclick = () => showModal('modal-text-edit');
  document.getElementById('btn-cancel-text').onclick = () => closeModal('modal-text-edit');
  document.getElementById('btn-confirm-text').onclick = updateFolderContent;

  // 단어장 모달
  document.getElementById('btn-open-voca').onclick = openVocaModal;
  document.getElementById('btn-close-voca').onclick = () => closeModal('modal-voca');

  // AI 복사 & 가져오기
  document.getElementById('btn-ai-prompt').onclick = copyAIPrompt;
  document.getElementById('btn-ai-import').onclick = () => showModal('modal-ai-import');
  document.getElementById('btn-cancel-ai').onclick = () => closeModal('modal-ai-import');
  document.getElementById('btn-confirm-ai').onclick = importAIResult;

  // 캐러셀 네비게이션
  document.getElementById('btn-prev-page').onclick = () => movePage(-1);
  document.getElementById('btn-next-page').onclick = () => movePage(1);

  // 퀴즈
  document.getElementById('btn-start-quiz').onclick = startQuiz;
  document.getElementById('btn-exit-quiz').onclick = () => switchView('view-viewer');

  // 본문 전체 복사
  document.getElementById('btn-copy-text').onclick = () => {
    const folder = getCurrentFolder();
    if (folder) {
      navigator.clipboard.writeText(folder.rawText || "");
      alert('본문이 클립보드에 복사되었습니다.');
    }
  };
});

function saveData() {
  localStorage.setItem('folders', JSON.stringify(folders));
}

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function getCurrentFolder() {
  return folders.find(f => f.id === currentFolderId);
}

// 1. 폴더 목록 렌더링 및 롱프레스
function renderFolders() {
  folderGrid.innerHTML = '';
  folders.forEach(folder => {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.innerText = folder.name;

    let timer;
    card.addEventListener('touchstart', () => {
      timer = setTimeout(() => showFolderManageModal(folder.id), 600);
    });
    card.addEventListener('touchend', () => clearTimeout(timer));
    card.onclick = () => openFolder(folder.id);

    folderGrid.appendChild(card);
  });
}

function createFolder() {
  const nameInput = document.getElementById('input-folder-name');
  if (!nameInput.value.trim()) return;

  const newFolder = {
    id: Date.now(),
    name: nameInput.value.trim(),
    rawText: '',
    pages: [],
    words: [] // { term, mean, type: 'word'|'idiom' }
  };

  folders.unshift(newFolder); // 최신순
  saveData();
  renderFolders();
  nameInput.value = '';
  closeModal('modal-folder');
}

function showFolderManageModal(id) {
  showModal('modal-folder-manage');
  document.getElementById('btn-delete-folder').onclick = () => {
    folders = folders.filter(f => f.id !== id);
    saveData();
    renderFolders();
    closeModal('modal-folder-manage');
  };
  document.getElementById('btn-rename-folder').onclick = () => {
    const newName = prompt('새 폴더 이름을 입력하세요:');
    if (newName) {
      const folder = folders.find(f => f.id === id);
      if (folder) folder.name = newName;
      saveData();
      renderFolders();
    }
    closeModal('modal-folder-manage');
  };
  document.getElementById('btn-cancel-manage').onclick = () => closeModal('modal-folder-manage');
}

// 2. 캐러셀 뷰어 & 문장 나눔 (. , ? !)
function openFolder(id) {
  currentFolderId = id;
  const folder = getCurrentFolder();
  document.getElementById('viewer-folder-title').innerText = folder.name;
  currentPageIndex = 0;
  renderCarousel();
  switchView('view-viewer');
}

function updateFolderContent() {
  const text = document.getElementById('textarea-body-input').value;
  const folder = getCurrentFolder();
  folder.rawText = text;

  // 문장 부호( . , ? ! ) 기준 나눔
  const sentences = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  
  // 5문장씩 페이지 구분
  folder.pages = [];
  for (let i = 0; i < sentences.length; i += 5) {
    folder.pages.push(sentences.slice(i, i + 5));
  }
  if (folder.pages.length === 0) folder.pages = [[]];

  saveData();
  renderCarousel();
  closeModal('modal-text-edit');
}

function renderCarousel() {
  const folder = getCurrentFolder();
  const track = document.getElementById('carousel-track');
  track.innerHTML = '';

  folder.pages.forEach((pageSentences, idx) => {
    const pageCard = document.createElement('div');
    pageCard.className = `page-card ${idx === currentPageIndex ? 'active-page' : ''}`;

    pageSentences.forEach(sentence => {
      const p = document.createElement('p');
      p.className = 'paragraph-block';
      p.innerHTML = sentence.replace(/([a-zA-Z0-9'-]+)/g, '<span class="word-span">$1</span>');
      pageCard.appendChild(p);
    });

    // 단어 클릭 시 하이라이트 및 추가
    pageCard.querySelectorAll('.word-span').forEach(span => {
      span.onclick = (e) => {
        const wordStr = e.target.innerText.toLowerCase();
        span.classList.toggle('highlight');
        toggleWordInVoca(wordStr);
      };
    });

    track.appendChild(pageCard);
  });
}

function movePage(dir) {
  const folder = getCurrentFolder();
  const maxPages = folder.pages.length;
  currentPageIndex = Math.max(0, Math.min(currentPageIndex + dir, maxPages - 1));
  renderCarousel();
}

function toggleWordInVoca(term) {
  const folder = getCurrentFolder();
  const idx = folder.words.findIndex(w => w.term.toLowerCase() === term);
  if (idx > -1) {
    folder.words.splice(idx, 1);
  } else {
    folder.words.push({ term, mean: '', type: term.includes(' ') ? 'idiom' : 'word' });
  }
  saveData();
}

// 3. 단어장 및 AI 프롬프트
function openVocaModal() {
  showModal('modal-voca');
  renderVocaList();

  document.getElementById('tab-word').onclick = () => { activeTab = 'word'; updateTabs(); };
  document.getElementById('tab-idiom').onclick = () => { activeTab = 'idiom'; updateTabs(); };
}

function updateTabs() {
  document.getElementById('tab-word').classList.toggle('active', activeTab === 'word');
  document.getElementById('tab-idiom').classList.toggle('active', activeTab === 'idiom');
  renderVocaList();
}

function renderVocaList() {
  const folder = getCurrentFolder();
  const listContainer = document.getElementById('voca-list-container');
  listContainer.innerHTML = '';

  const filteredWords = folder.words.filter(w => (activeTab === 'word' ? w.type !== 'idiom' : w.type === 'idiom'));

  filteredWords.forEach(w => {
    const item = document.createElement('div');
    item.className = 'voca-item';
    item.innerHTML = `
      <span>${w.term}</span>
      <input type="text" placeholder="뜻 입력" value="${w.mean}">
    `;
    item.querySelector('input').onchange = (e) => {
      w.mean = e.target.value;
      saveData();
      checkQuizButtonState();
    };
    listContainer.appendChild(item);
  });

  checkQuizButtonState();
}

function checkQuizButtonState() {
  const folder = getCurrentFolder();
  const allFilled = folder.words.length > 0 && folder.words.every(w => w.mean.trim() !== '');
  document.getElementById('btn-start-quiz').disabled = !allFilled;
}

function copyAIPrompt() {
  const folder = getCurrentFolder();
  const promptText = `[본문]\n${folder.rawText}\n\n[단어]\n${folder.words.map(w => w.term).join('\n')}\n\n본문 내용을 토대로 단어의 뜻을 단어: 뜻 형태로 적어줘. 숙어라면 밑에 작성해줘.`;
  navigator.clipboard.writeText(promptText);
  alert('AI 프롬프트가 클립보드에 복사되었습니다.');
}

function importAIResult() {
  const text = document.getElementById('textarea-ai-response').value;
  const folder = getCurrentFolder();
  const lines = text.split('\n');

  lines.forEach(line => {
    if (line.includes(':')) {
      const [term, mean] = line.split(':').map(s => s.trim());
      const target = folder.words.find(w => w.term.toLowerCase() === term.toLowerCase());
      if (target) {
        target.mean = mean;
      }
    }
  });

  saveData();
  closeModal('modal-ai-import');
  renderVocaList();
}

// 4. 단어 퀴즈 로직
function startQuiz() {
  const folder = getCurrentFolder();
  currentQuizList = [...folder.words].sort(() => Math.random() - 0.5); // 랜덤
  quizIndex = 0;
  quizWrongs = [];

  closeModal('modal-voca');
  switchView('view-quiz');
  renderQuizStep();
}

function renderQuizStep() {
  document.getElementById('quiz-remaining').innerText = currentQuizList.length - quizIndex;
  document.getElementById('quiz-wrongs').innerText = quizWrongs.length;

  const cardArea = document.getElementById('quiz-card-area');
  cardArea.innerHTML = '';

  if (quizIndex >= currentQuizList.length) {
    // 퀴즈 완료
    cardArea.innerHTML = `
      <div class="quiz-card">
        <h2>퀴즈 완료!</h2>
        <p style="margin: 16px 0;">맞힌 단어는 단어장에서 삭제 처리되었습니다.</p>
        <button id="btn-re-quiz" class="primary-btn">틀린 단어로 재퀴즈</button>
      </div>
    `;
    if (quizWrongs.length > 0) {
      document.getElementById('btn-re-quiz').onclick = () => {
        currentQuizList = [...quizWrongs];
        quizIndex = 0;
        quizWrongs = [];
        renderQuizStep();
      };
    } else {
      document.getElementById('btn-re-quiz').style.display = 'none';
    }
    return;
  }

  const currentItem = currentQuizList[quizIndex];
  cardArea.innerHTML = `
    <div class="quiz-card">
      <div class="quiz-word">${currentItem.term}</div>
      <input type="text" id="input-quiz-answer" placeholder="뜻을 입력하세요 (엔터)" autofocus>
      <div id="quiz-feedback"></div>
    </div>
  `;

  const input = document.getElementById('input-quiz-answer');
  input.onkeypress = (e) => {
    if (e.key === 'Enter') {
      const userAns = input.value.trim();
      const feedback = document.getElementById('quiz-feedback');

      if (userAns === currentItem.mean.trim()) {
        feedback.className = 'feedback correct';
        feedback.innerText = '정답!';
        // 맞힌 단어는 단어장 목록 및 본문 형광펜에서 삭제
        removeWordFromFolder(currentItem.term);
        setTimeout(nextQuiz, 800);
      } else {
        feedback.className = 'feedback wrong';
        feedback.innerHTML = `
          오답! (정답: ${currentItem.mean})<br>
          <button id="btn-override-correct" class="secondary-btn" style="margin-top:8px;">채점이 잘못되었어요 (정답 처리)</button>
        `;
        quizWrongs.push(currentItem);

        document.getElementById('btn-override-correct').onclick = () => {
          quizWrongs.pop(); // 오답 목록에서 제외
          removeWordFromFolder(currentItem.term);
          nextQuiz();
        };
      }
    }
  };
}

function nextQuiz() {
  quizIndex++;
  renderQuizStep();
}

function removeWordFromFolder(term) {
  const folder = getCurrentFolder();
  folder.words = folder.words.filter(w => w.term.toLowerCase() !== term.toLowerCase());
  saveData();
}