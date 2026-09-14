// 애플리케이션 상태 관리
const state = {
    folders: [],
    currentFolderId: null,
    currentNoteIndex: 0,
    
    quizQueue: [],
    quizCurrentIndex: 0,
    quizCorrectCount: 0,
    quizWrongCount: 0,
    quizTimer: null,

    inputCallback: null,
    selectedWordId: null,
    selectedFolderId: null
};

// 1. 데이터 저장/로드
function saveData() {
    const dataToSave = {
        folders: state.folders
    };
    localStorage.setItem('vocaApp_data', JSON.stringify(dataToSave));
}

function loadData() {
    const saved = localStorage.getItem('vocaApp_data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.folders = parsed.folders || [];
            
            state.folders.forEach(folder => {
                if (!folder.createdAt) folder.createdAt = folder.id || Date.now();
                if (!folder.notes) folder.notes = [];
                folder.notes = folder.notes.map(note => {
                    if (typeof note === 'string') {
                        return { text: note, vocabList: [] };
                    }
                    return {
                        text: note.text || "",
                        vocabList: note.vocabList || []
                    };
                });
            });
        } catch (e) {
            console.error("데이터 로드 실패", e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initEventListeners();
    renderFolders();
});

function initEventListeners() {
    document.getElementById('btn-add-folder').addEventListener('click', openNewFolderModal);
    document.getElementById('btn-back-main').addEventListener('click', () => showScreen('main-screen'));
    document.getElementById('btn-edit-text').addEventListener('click', openEditTextModal);
    document.getElementById('btn-open-vocab').addEventListener('click', openVocabModal);

    document.getElementById('btn-copy-note').addEventListener('click', copyCurrentNoteText);

    document.getElementById('btn-prev-slide').addEventListener('click', () => moveSlide(-1));
    document.getElementById('btn-next-slide').addEventListener('click', () => moveSlide(1));

    document.getElementById('btn-close-vocab').addEventListener('click', closeVocabModal);
    document.getElementById('btn-start-quiz').addEventListener('click', startQuiz);
    document.getElementById('btn-copy-prompt').addEventListener('click', copyAIPrompt);
    document.getElementById('btn-import-ai').addEventListener('click', openImportAIModal);

    document.getElementById('btn-input-cancel').addEventListener('click', closeInputModal);
    document.getElementById('btn-input-submit').addEventListener('click', submitInputModal);

    document.getElementById('btn-opt-edit').addEventListener('click', triggerEditWord);
    document.getElementById('btn-opt-toggle').addEventListener('click', triggerToggleIdiom);
    document.getElementById('btn-opt-delete').addEventListener('click', triggerDeleteWord);
    document.getElementById('btn-opt-cancel').addEventListener('click', closeWordOptionModal);

    document.getElementById('btn-folder-rename').addEventListener('click', triggerRenameFolder);
    document.getElementById('btn-folder-delete').addEventListener('click', triggerDeleteFolder);
    document.getElementById('btn-folder-cancel').addEventListener('click', closeFolderOptionModal);

    document.getElementById('btn-exit-quiz').addEventListener('click', abandonQuiz);
    document.getElementById('quiz-input-answer').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitQuizAnswer();
    });
    
    document.getElementById('btn-skip-quiz').addEventListener('click', skipQuizQuestion);
    document.getElementById('btn-override').addEventListener('click', overrideCorrect);
    document.getElementById('btn-close-result').addEventListener('click', closeResultToVocab);

    document.getElementById('feedback-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'btn-override') return;
        skipFeedbackToNext();
    });

    window.addEventListener('resize', () => {
        if (document.getElementById('note-screen').classList.contains('active')) {
            updateSliderPosition();
        }
    });
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    if (screenId === 'main-screen') renderFolders();
}

function getCurrentFolder() {
    return state.folders.find(f => f.id === state.currentFolderId);
}

function getCurrentNote() {
    const folder = getCurrentFolder();
    if (!folder || !folder.notes || folder.notes.length === 0) return null;
    return folder.notes[state.currentNoteIndex];
}

function getCurrentVocabList() {
    const note = getCurrentNote();
    return note ? note.vocabList : [];
}

// 폴더 기능 (오래된 순서대로 정렬: 새 파일일수록 앞, 오래될수록 뒤)
function renderFolders() {
    const grid = document.getElementById('folder-grid');
    grid.innerHTML = '';
    
    // createdAt 기준 오름차순 정렬 (오래된 것일수록 뒤로 정렬)
    const sortedFolders = [...state.folders].sort((a, b) => (b.createdAt || b.id) - (a.createdAt || a.id));

    sortedFolders.forEach(folder => {
        const card = document.createElement('div');
        card.className = 'folder-card';
        card.innerHTML = `<div class="folder-title-badge">${escapeHtml(folder.title)}</div>`;

        let pressTimer = null;

        card.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                openFolderOptions(folder.id);
            }, 500);
        });

        card.addEventListener('touchend', () => clearTimeout(pressTimer));
        card.addEventListener('touchmove', () => clearTimeout(pressTimer));

        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openFolderOptions(folder.id);
        });

        card.onclick = (e) => {
            if (pressTimer) clearTimeout(pressTimer);
            openFolder(folder.id);
        };

        grid.appendChild(card);
    });
}

function openFolderOptions(id) {
    state.selectedFolderId = id;
    document.getElementById('folder-option-modal').classList.add('active');
}

function closeFolderOptionModal() {
    document.getElementById('folder-option-modal').classList.remove('active');
    state.selectedFolderId = null;
}

function triggerRenameFolder() {
    const folder = state.folders.find(f => f.id === state.selectedFolderId);
    closeFolderOptionModal();
    if (folder) {
        showInputModal("폴더 이름 수정", folder.title, (newTitle) => {
            if (newTitle.trim()) {
                folder.title = newTitle.trim();
                saveData();
                renderFolders();
            }
        });
    }
}

function triggerDeleteFolder() {
    const folder = state.folders.find(f => f.id === state.selectedFolderId);
    closeFolderOptionModal();
    if (folder && confirm(`'${folder.title}' 폴더를 정말 삭제하시겠습니까?`)) {
        state.folders = state.folders.filter(f => f.id !== folder.id);
        saveData();
        renderFolders();
    }
}

function openNewFolderModal() {
    showInputModal("새 폴더 생성", "", (val) => {
        if (!val.trim()) return;
        const now = Date.now();
        state.folders.push({
            id: now,
            createdAt: now,
            title: val.trim(),
            notes: [{ text: "", vocabList: [] }]
        });
        saveData();
        renderFolders();
    });
}

function openFolder(folderId) {
    state.currentFolderId = folderId;
    state.currentNoteIndex = 0;
    const folder = getCurrentFolder();
    if (!folder) return;
    document.getElementById('current-folder-title').innerText = folder.title;
    renderSlider();
    showScreen('note-screen');
}

// 노트 캐러셀 슬라이더
function renderSlider() {
    const folder = getCurrentFolder();
    const wrapper = document.getElementById('slider-wrapper');
    wrapper.innerHTML = '';

    if (!folder) return;

    if (folder.notes.length === 0) {
        folder.notes.push({ text: "", vocabList: [] });
    }

    folder.notes.forEach((noteObj, idx) => {
        const page = document.createElement('div');
        page.className = 'note-page';
        
        page.onclick = (e) => {
            if (idx !== state.currentNoteIndex) {
                state.currentNoteIndex = idx;
                updateSliderPosition();
            }
        };

        if (!noteObj.text.trim()) {
            page.innerHTML = `
                <div style="height:100%; display:flex; align-items:center; justify-content:center;">
                    <button class="btn btn-primary" onclick="openEditTextModal()">+ 본문 추가</button>
                </div>
            `;
        } else {
            page.innerHTML = parseNoteText(noteObj.text, idx);
        }
        wrapper.appendChild(page);
    });

    wrapper.appendChild(createAddPageCard());
    
    setTimeout(updateSliderPosition, 10);
}

function createAddPageCard() {
    const card = document.createElement('div');
    card.className = 'add-page-btn';
    card.onclick = () => {
        const folder = getCurrentFolder();
        folder.notes.push({ text: "", vocabList: [] });
        state.currentNoteIndex = folder.notes.length - 1;
        saveData();
        renderSlider();
    };
    card.innerHTML = `<div class="plus-circle">+</div>`;
    return card;
}

function updateSliderPosition() {
    const wrapper = document.getElementById('slider-wrapper');
    const cards = wrapper.children;
    if (cards.length === 0) return;

    Array.from(cards).forEach((card, idx) => {
        if (idx === state.currentNoteIndex) {
            card.classList.add('active-page');
        } else {
            card.classList.remove('active-page');
        }
    });

    const container = document.querySelector('.slider-container');
    const containerWidth = container.offsetWidth;
    const targetCard = cards[state.currentNoteIndex];
    
    if (!targetCard) return;

    const cardWidth = targetCard.offsetWidth;
    const cardLeft = targetCard.offsetLeft;

    const centerOffset = (containerWidth / 2) - (cardLeft + cardWidth / 2);

    wrapper.style.transform = `translateX(${centerOffset}px)`;
}

function moveSlide(dir) {
    const folder = getCurrentFolder();
    const maxIdx = folder ? folder.notes.length : 0;
    state.currentNoteIndex = Math.max(0, Math.min(state.currentNoteIndex + dir, maxIdx));
    updateSliderPosition();
}

function openEditTextModal() {
    const folder = getCurrentFolder();
    if (!folder) return;
    
    if (state.currentNoteIndex >= folder.notes.length) {
        folder.notes.push({ text: "", vocabList: [] });
    }

    const currentNote = folder.notes[state.currentNoteIndex];

    showInputModal("본문 수정", currentNote.text || "", (text) => {
        currentNote.text = text;
        saveData();
        renderSlider();
    });
}

// 스마트 문장 분리
function splitSentences(text) {
    if (!text) return [];

    const rawTokens = text.split(/(\s+)/);
    const abbrRegex = /^(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|Vol|No|[A-Z])\.$/i;

    let sentences = [];
    let currentSentence = "";

    for (let i = 0; i < rawTokens.length; i++) {
        let token = rawTokens[i];
        currentSentence += token;

        const trimmed = token.trim();
        if (/[.!?]$/.test(trimmed) && !abbrRegex.test(trimmed)) {
            if (currentSentence.trim()) {
                sentences.push(currentSentence.trim().replace(/\s+/g, ' '));
            }
            currentSentence = "";
        }
    }

    if (currentSentence.trim()) {
        sentences.push(currentSentence.trim().replace(/\s+/g, ' '));
    }

    return sentences;
}

// 노트 본문 렌더링
function parseNoteText(text, noteIdx) {
    if (!text) return '';

    const sentences = splitSentences(text);
    const folder = getCurrentFolder();
    const noteObj = folder ? folder.notes[noteIdx] : null;
    const vocabList = noteObj ? noteObj.vocabList : [];

    return sentences.map(sentence => {
        const tokens = sentence.split(/([a-zA-Z0-9]+)/);
        const parsed = tokens.map(token => {
            if (/^[a-zA-Z0-9]+$/.test(token)) {
                const lowerToken = token.toLowerCase();
                const isCollected = vocabList.some(v => v.word.toLowerCase() === lowerToken);
                const highlightClass = isCollected ? 'highlight' : '';
                return `<span class="clickable-word ${highlightClass}" data-word="${escapeHtml(lowerToken)}" onclick="handleWordClick(event, this, '${escapeHtml(token)}', ${noteIdx})">${escapeHtml(token)}</span>`;
            }
            return escapeHtml(token);
        }).join('');

        return `<p style="margin-bottom: 16px; line-height: 1.7;">${parsed}</p>`;
    }).join('');
}

function handleWordClick(event, el, wordStr, noteIdx) {
    if (noteIdx !== state.currentNoteIndex) {
        event.stopPropagation();
        state.currentNoteIndex = noteIdx;
        updateSliderPosition();
        return;
    }
    toggleWordClick(el, wordStr);
}

function toggleWordClick(el, wordStr) {
    const vocabList = getCurrentVocabList();
    const lowerWord = wordStr.toLowerCase();
    const idx = vocabList.findIndex(v => v.word.toLowerCase() === lowerWord);
    const sameWords = document.querySelectorAll(`.note-page.active-page .clickable-word[data-word="${lowerWord}"]`);

    if (idx > -1) {
        vocabList.splice(idx, 1);
        sameWords.forEach(w => w.classList.remove('highlight'));
    } else {
        vocabList.push({
            id: Date.now() + Math.random(),
            word: wordStr,
            type: 'word',
            mean: ''
        });
        sameWords.forEach(w => w.classList.add('highlight'));
    }
    saveData();
}

// 단어장 관리
function openVocabModal() {
    renderVocabList();
    document.getElementById('vocab-modal').classList.add('active');
}

function closeVocabModal() {
    document.getElementById('vocab-modal').classList.remove('active');
}

function renderVocabList() {
    const vocabList = getCurrentVocabList();
    const wordListEl = document.getElementById('word-list');
    const idiomListEl = document.getElementById('idiom-list');
    wordListEl.innerHTML = '';
    idiomListEl.innerHTML = '';

    vocabList.forEach(item => {
        const row = document.createElement('div');
        row.className = 'vocab-item';
        row.innerHTML = `
            <div class="vocab-word" ondblclick="openWordOptions('${item.id}')">${escapeHtml(item.word)}</div>
            <input type="text" class="vocab-input" placeholder="뜻 적기" value="${escapeHtml(item.mean)}" oninput="updateWordMean('${item.id}', this.value)">
        `;

        if (item.type === 'word') wordListEl.appendChild(row);
        else idiomListEl.appendChild(row);
    });

    checkQuizAvailability();
}

function updateWordMean(id, value) {
    const vocabList = getCurrentVocabList();
    const item = vocabList.find(v => v.id == id);
    if (item) item.mean = value;
    saveData();
    checkQuizAvailability();
}

function checkQuizAvailability() {
    const vocabList = getCurrentVocabList();
    const btnQuiz = document.getElementById('btn-start-quiz');
    const canStart = vocabList.length > 0 && vocabList.every(v => v.mean.trim() !== '');
    btnQuiz.style.display = canStart ? 'block' : 'none';
}

function openWordOptions(id) {
    state.selectedWordId = id;
    document.getElementById('word-option-modal').classList.add('active');
}

function closeWordOptionModal() {
    document.getElementById('word-option-modal').classList.remove('active');
    state.selectedWordId = null;
}

function triggerEditWord() {
    const vocabList = getCurrentVocabList();
    const item = vocabList.find(v => v.id == state.selectedWordId);
    closeWordOptionModal();
    if (item) {
        showInputModal("단어 수정", item.word, (newWord) => {
            if (newWord.trim()) {
                item.word = newWord.trim();
                saveData();
                renderVocabList();
                renderSlider();
            }
        });
    }
}

function triggerToggleIdiom() {
    const vocabList = getCurrentVocabList();
    const item = vocabList.find(v => v.id == state.selectedWordId);
    if (item) {
        item.type = item.type === 'word' ? 'idiom' : 'word';
        saveData();
        renderVocabList();
    }
    closeWordOptionModal();
}

function triggerDeleteWord() {
    const note = getCurrentNote();
    if (note) {
        note.vocabList = note.vocabList.filter(v => v.id != state.selectedWordId);
        saveData();
        closeWordOptionModal();
        renderVocabList();
        renderSlider();
    }
}

function copyAIPrompt() {
    const note = getCurrentNote();
    const bodyText = note ? note.text : '';
    const vocabList = getCurrentVocabList();
    const wordsText = vocabList.map(v => `- ${v.word}`).join('\n');

    const promptText = `[본문]\n${bodyText}\n\n[단어 목록]\n${wordsText}\n\n위 본문을 참고해서 단어 목록의 뜻을 적어줘. 만약 단어가 아닌 숙어라면 숙어로 분류해 줘.\n답변은 부연설명 없이 반드시 아래 양식처럼만 작성해 줘:\n\n단어 : 뜻\n단어 : 뜻`;

    navigator.clipboard.writeText(promptText).then(() => {
        alert('프롬프트가 클립보드에 복사되었습니다. AI에게 붙여넣은 뒤 답변을 복사하세요!');
    }).catch(() => {
        alert('복사에 실패했습니다.');
    });
}

function openImportAIModal() {
    showInputModal(
        "AI 응답 결과 일괄 등록",
        "",
        (pastedText) => {
            if (!pastedText.trim()) return;
            
            const vocabList = getCurrentVocabList();
            const lines = pastedText.split('\n');
            let updatedCount = 0;

            lines.forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const word = parts[0].replace(/^[-*\s]+/, '').trim().toLowerCase();
                    const mean = parts.slice(1).join(':').trim();

                    const targetWord = vocabList.find(v => v.word.toLowerCase() === word);
                    if (targetWord && mean) {
                        targetWord.mean = mean;
                        updatedCount++;
                    }
                }
            });

            saveData();
            renderVocabList();
            alert(`${updatedCount}개 단어의 뜻이 성공적으로 등록되었습니다!`);
        }
    );
}

// 퀴즈 시스템
function startQuiz() {
    closeVocabModal();
    const vocabList = getCurrentVocabList();
    state.quizQueue = [...vocabList].sort(() => Math.random() - 0.5);
    state.quizCurrentIndex = 0;
    state.quizCorrectCount = 0;
    state.quizWrongCount = 0;

    showScreen('quiz-screen');
    loadNextQuiz();
}

function loadNextQuiz() {
    if (state.quizCurrentIndex >= state.quizQueue.length) {
        showQuizResult();
        return;
    }

    const item = state.quizQueue[state.quizCurrentIndex];
    document.getElementById('quiz-remaining').innerText = state.quizQueue.length - state.quizCurrentIndex;
    document.getElementById('quiz-wrong-count').innerText = state.quizWrongCount;
    document.getElementById('quiz-target-word').innerText = item.word;

    const inputEl = document.getElementById('quiz-input-answer');
    inputEl.value = '';
    inputEl.focus();
}

function submitQuizAnswer() {
    if (state.quizTimer) clearTimeout(state.quizTimer);

    const inputEl = document.getElementById('quiz-input-answer');
    const userInput = inputEl.value.trim();
    const currentItem = state.quizQueue[state.quizCurrentIndex];

    const validAnswers = currentItem.mean.split(',').map(m => m.trim().toLowerCase());
    const isCorrect = validAnswers.includes(userInput.toLowerCase());

    const overlay = document.getElementById('feedback-overlay');
    const feedbackText = document.getElementById('feedback-text');
    const overrideBtn = document.getElementById('btn-override');

    if (isCorrect) {
        state.quizCorrectCount++;
        currentItem._isCorrect = true;
        feedbackText.innerHTML = `
            <div style="text-align: center; width: 100%;">
                <div style="font-size: 1.8rem; color: #555; margin-bottom: 12px; font-weight: 500;">[뜻] ${escapeHtml(currentItem.mean)}</div>
                <div style="font-size: 4rem; font-weight: 800; color: #2ecc71;">정답!</div>
            </div>`;
        overrideBtn.style.display = "none";
    } else {
        state.quizWrongCount++;
        currentItem._isCorrect = false;
        feedbackText.innerHTML = `
            <div style="text-align: center; width: 100%;">
                <div style="font-size: 1.8rem; color: #555; margin-bottom: 12px; font-weight: 500;">[뜻] ${escapeHtml(currentItem.mean)}</div>
                <div style="font-size: 4rem; font-weight: 800; color: #e74c3c;">오답</div>
            </div>`;
        overrideBtn.style.display = "block";
    }

    overlay.classList.add('active');

    state.quizTimer = setTimeout(() => {
        skipFeedbackToNext();
    }, 1800);
}

function skipQuizQuestion() {
    if (state.quizTimer) clearTimeout(state.quizTimer);

    const currentItem = state.quizQueue[state.quizCurrentIndex];
    const overlay = document.getElementById('feedback-overlay');
    const feedbackText = document.getElementById('feedback-text');
    const overrideBtn = document.getElementById('btn-override');

    state.quizWrongCount++;
    currentItem._isCorrect = false;
    feedbackText.innerHTML = `
        <div style="text-align: center; width: 100%;">
            <div style="font-size: 1.8rem; color: #555; margin-bottom: 12px; font-weight: 500;">[뜻] ${escapeHtml(currentItem.mean)}</div>
            <div style="font-size: 4rem; font-weight: 800; color: #e74c3c;">오답</div>
        </div>`;
    overrideBtn.style.display = "block";

    overlay.classList.add('active');

    state.quizTimer = setTimeout(() => {
        skipFeedbackToNext();
    }, 1800);
}

function skipFeedbackToNext() {
    if (state.quizTimer) {
        clearTimeout(state.quizTimer);
        state.quizTimer = null;
    }
    const overlay = document.getElementById('feedback-overlay');
    if (overlay.classList.contains('active')) {
        overlay.classList.remove('active');
        state.quizCurrentIndex++;
        loadNextQuiz();
    }
}

function overrideCorrect() {
    if (state.quizTimer) clearTimeout(state.quizTimer);

    state.quizWrongCount--;
    state.quizCorrectCount++;
    const currentItem = state.quizQueue[state.quizCurrentIndex];
    currentItem._isCorrect = true;

    document.getElementById('feedback-overlay').classList.remove('active');
    state.quizCurrentIndex++;
    loadNextQuiz();
}

function abandonQuiz() {
    if (confirm("퀴즈를 포기하시겠습니까? 지금까지 맞춘 단어만 단어장에서 삭제됩니다.")) {
        if (state.quizTimer) clearTimeout(state.quizTimer);
        
        for (let i = state.quizCurrentIndex; i < state.quizQueue.length; i++) {
            if (state.quizQueue[i]._isCorrect === undefined) {
                state.quizQueue[i]._isCorrect = false;
                state.quizWrongCount++;
            }
        }
        showQuizResult();
    }
}

function showQuizResult() {
    document.getElementById('result-correct').innerText = state.quizCorrectCount;
    document.getElementById('result-wrong').innerText = state.quizWrongCount;

    const correctIds = state.quizQueue.filter(q => q._isCorrect).map(q => q.id);
    const note = getCurrentNote();
    if (note) {
        note.vocabList = note.vocabList.filter(v => !correctIds.includes(v.id));
    }

    saveData();
    showScreen('result-screen');
}

function closeResultToVocab() {
    showScreen('note-screen');
    openVocabModal();
    renderSlider();
}

// 공통 입력 모달
function showInputModal(title, initialVal, callback) {
    document.getElementById('input-modal-title').innerText = title;
    const inputEl = document.getElementById('input-modal-value');
    inputEl.value = initialVal;
    state.inputCallback = callback;
    document.getElementById('input-modal').classList.add('active');
    inputEl.focus();
}

function closeInputModal() {
    document.getElementById('input-modal').classList.remove('active');
    state.inputCallback = null;
}

function submitInputModal() {
    const val = document.getElementById('input-modal-value').value;
    if (state.inputCallback) state.inputCallback(val);
    closeInputModal();
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
}

function copyCurrentNoteText() {
    const note = getCurrentNote();
    if (!note || !note.text.trim()) {
        alert('복사할 본문 내용이 없습니다.');
        return;
    }

    const sentences = splitSentences(note.text);
    const formattedText = sentences.join('\n\n');

    navigator.clipboard.writeText(formattedText)
        .then(() => {
            alert('문장 사이에 공백이 들어간 형태로 복사되었습니다!');
        })
        .catch(err => {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다.');
        });
}