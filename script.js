// 점심 메뉴 투표 앱 스크립트

document.addEventListener('DOMContentLoaded', () => {
  // 1. 상태 변수 및 요소 참조
  const STORAGE_KEY = 'lunch_menu_votes_v1';
  
  const menuMeta = {
    bibimbap: { name: '비빔밥', emoji: '🍚' },
    tonkatsu: { name: '돈까스', emoji: '🍱' },
    gukbap: { name: '국밥', emoji: '🍲' },
    salad: { name: '샐러드', emoji: '🥗' }
  };

  // 투표 데이터 로드 (기본값: 각 0표)
  let votes = loadVotes();
  let selectedMenuId = null;

  // DOM 요소
  const menuCards = document.querySelectorAll('.menu-card');
  const voteBtn = document.getElementById('voteBtn');
  const btnText = voteBtn.querySelector('.btn-text');
  const btnIcon = voteBtn.querySelector('.btn-icon');
  const totalVotesEl = document.getElementById('totalVotes');
  const resetBtn = document.getElementById('resetBtn');
  const toast = document.getElementById('toast');

  let toastTimeout = null;

  // 2. 초기 렌더링
  updateResultsUI();

  // 3. 메뉴 카드 선택 이벤트
  menuCards.forEach(card => {
    // 마우스 클릭
    card.addEventListener('click', () => {
      const menuId = card.dataset.id;
      selectMenu(menuId);
    });

    // 키보드 엔터/스페이스 접근성
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectMenu(card.dataset.id);
      }
    });
  });

  // 메뉴 선택 처리 함수
  function selectMenu(menuId) {
    selectedMenuId = menuId;

    menuCards.forEach(card => {
      const isSelected = card.dataset.id === menuId;
      card.classList.toggle('selected', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    // 투표 버튼 활성화 및 문구 변경
    voteBtn.disabled = false;
    const item = menuMeta[menuId];
    btnText.textContent = `'${item.name}'에 투표하기`;
    btnIcon.textContent = '🗳️';
  }

  // 4. 투표하기 버튼 클릭 이벤트
  voteBtn.addEventListener('click', () => {
    if (!selectedMenuId) return;

    // 표수 증가
    votes[selectedMenuId] = (votes[selectedMenuId] || 0) + 1;
    saveVotes();

    // 결과 UI 업데이트
    updateResultsUI();

    // 토스트 알림 표시
    const selectedItem = menuMeta[selectedMenuId];
    showToast(`🎉 ${selectedItem.emoji} '${selectedItem.name}'에 1표를 더했습니다!`);

    // 버튼 클릭 피드백 효과
    voteBtn.style.transform = 'scale(0.97)';
    setTimeout(() => {
      voteBtn.style.transform = '';
    }, 150);
  });

  // 5. 결과 영역 갱신 함수
  function updateResultsUI() {
    // 총 득표수 계산
    const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
    totalVotesEl.textContent = totalVotes.toLocaleString();

    // 최다 득표수 및 1위 항목 계산 (동률 포함, 0표 제외)
    let maxVotes = 0;
    if (totalVotes > 0) {
      maxVotes = Math.max(...Object.values(votes));
    }

    // 각 메뉴별 통계 갱신
    Object.keys(menuMeta).forEach(id => {
      const count = votes[id] || 0;
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

      const itemEl = document.getElementById(`result-${id}`);
      if (!itemEl) return;

      const countEl = itemEl.querySelector('.vote-count');
      const percentEl = itemEl.querySelector('.vote-percentage');
      const fillEl = itemEl.querySelector('.progress-bar-fill');
      const badgeEl = itemEl.querySelector('.leader-badge');

      // 득표수 & 백분율 표시
      countEl.textContent = `${count}표`;
      percentEl.textContent = `${percentage}%`;
      fillEl.style.width = `${percentage}%`;

      // 1위 뱃지 및 하이라이트 (1표 이상이고 최다 득표인 경우)
      const isLeader = totalVotes > 0 && count === maxVotes && count > 0;
      if (isLeader) {
        badgeEl.classList.remove('hidden');
        itemEl.classList.add('highlight');
      } else {
        badgeEl.classList.add('hidden');
        itemEl.classList.remove('highlight');
      }
    });
  }

  // 6. 투표 초기화
  resetBtn.addEventListener('click', () => {
    if (confirm('투표 결과를 모두 초기화하시겠습니까?')) {
      votes = {
        bibimbap: 0,
        tonkatsu: 0,
        gukbap: 0,
        salad: 0
      };
      saveVotes();
      updateResultsUI();

      // 선택 상태 해제
      selectedMenuId = null;
      menuCards.forEach(card => {
        card.classList.remove('selected');
        card.setAttribute('aria-checked', 'false');
      });
      voteBtn.disabled = true;
      btnText.textContent = '메뉴를 선택해 주세요';
      btnIcon.textContent = '👉';

      showToast('🔄 투표 결과가 초기화되었습니다.');
    }
  });

  // 7. 로컬 스토리지 헬퍼
  function loadVotes() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('LocalStorage 로드 실패:', e);
    }
    return {
      bibimbap: 0,
      tonkatsu: 0,
      gukbap: 0,
      salad: 0
    };
  }

  function saveVotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(votes));
    } catch (e) {
      console.warn('LocalStorage 저장 실패:', e);
    }
  }

  // 8. 토스트 메시지 헬퍼
  function showToast(message) {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    toast.textContent = message;
    toast.classList.remove('hidden');

    toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }
});
