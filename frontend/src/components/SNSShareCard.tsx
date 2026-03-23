/**
 * Phase 2: SNS 바이럴 카드 컴포넌트
 * html2canvas로 렌더링 → 카카오/인스타/Web Share API 공유
 */
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import type { Recipe } from '../types';
import { CUISINE_LABELS, TYPE_LABELS } from '../types';
import toast from 'react-hot-toast';

interface SNSShareCardProps {
  recipes: Recipe[];
  userName?: string;
}

export default function SNSShareCard({ recipes, userName = '나' }: SNSShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsSharing(true);

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FAFAF9',
      });

      const dataUrl = canvas.toDataURL('image/png');

      if (navigator.share) {
        const blob = await fetch(dataUrl).then((r) => r.blob());
        const file = new File([blob], 'my-fridge-recipes.png', { type: 'image/png' });

        await navigator.share({
          title: '🧊 오늘 내 냉장고 레시피 3종',
          text: `${userName}의 냉장고 재료로 만드는 레시피예요! 리버스 레시피 앱 써보세요 🌿`,
          files: [file],
        });
        toast.success('공유 완료!');
      } else {
        // Fallback: download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'my-fridge-recipes.png';
        link.click();
        toast.success('카드 이미지가 저장되었습니다!');
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        toast.error('공유 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleKakaoShare = () => {
    // Kakao SDK share (requires Kakao JS SDK loaded)
    if (typeof window !== 'undefined' && (window as unknown as { Kakao?: { isInitialized?: () => boolean; Share?: { sendDefault: (opts: object) => void } } }).Kakao?.isInitialized?.()) {
      const kakao = (window as unknown as { Kakao: { Share: { sendDefault: (opts: object) => void } } }).Kakao;
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: '🧊 오늘 내 냉장고 레시피',
          description: `${recipes[0]?.recipe_title || '맛있는 레시피'} 포함 ${recipes.length}개 레시피`,
          imageUrl: 'https://reverse-recipe.app/og-image.jpg',
          link: {
            mobileWebUrl: import.meta.env.VITE_APP_URL || 'http://localhost:3000',
            webUrl: import.meta.env.VITE_APP_URL || 'http://localhost:3000',
          },
        },
        buttons: [
          {
            title: '레시피 보러가기',
            link: {
              mobileWebUrl: import.meta.env.VITE_APP_URL || 'http://localhost:3000',
              webUrl: import.meta.env.VITE_APP_URL || 'http://localhost:3000',
            },
          },
        ],
      });
    } else {
      toast.error('카카오 공유를 위한 초기화가 필요합니다.');
    }
  };

  const topRecipes = recipes.slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Toggle preview */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="w-full py-3.5 rounded-2xl font-semibold border-2"
        style={{ borderColor: '#FEE500', color: '#333', background: isVisible ? '#FEE500' : 'white' }}
      >
        📤 SNS 카드 {isVisible ? '숨기기' : '만들기'}
      </button>

      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Share card preview */}
          <div
            ref={cardRef}
            className="rounded-3xl overflow-hidden p-5 space-y-3"
            style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', fontFamily: 'Noto Sans KR, sans-serif' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🧊</span>
              <div>
                <h2 className="text-lg font-bold" style={{ color: '#065F46' }}>
                  오늘 내 냉장고 레시피
                </h2>
                <p className="text-xs" style={{ color: '#6EE7B7' }}>{userName}의 냉장고</p>
              </div>
            </div>

            {/* Recipe tiles */}
            {topRecipes.map((recipe, i) => (
              <div
                key={i}
                className="rounded-2xl p-4"
                style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: '#D1FAE5' }}
                  >
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm" style={{ color: '#1C1917' }}>
                      {recipe.recipe_title}
                    </h3>
                    <p className="text-xs" style={{ color: '#78716C' }}>
                      {CUISINE_LABELS[recipe.cuisine_type]} · {TYPE_LABELS[recipe.recipe_type]} · {recipe.estimated_total_time_minutes}분
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {recipe.ingredient_list.slice(0, 3).map((ing) => (
                        <span
                          key={ing.name}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#D1FAE5', color: '#065F46' }}
                        >
                          {ing.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="text-sm font-bold rounded-xl px-2 py-1 flex-shrink-0"
                    style={{ background: '#D1FAE5', color: '#10B981' }}
                  >
                    {Math.round((recipe.match_score || 0) * 100)}%
                  </div>
                </div>
              </div>
            ))}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs" style={{ color: '#059669' }}>
                🌿 리버스 레시피 앱에서 만들었어요
              </p>
              <p className="text-xs font-bold" style={{ color: '#10B981' }}>reverse-recipe.app</p>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm text-white"
              style={{ background: 'var(--primary)' }}
            >
              {isSharing ? '⏳ 저장 중...' : '📥 이미지 저장'}
            </button>
            <button
              onClick={handleKakaoShare}
              className="flex-1 py-3 rounded-2xl font-semibold text-sm"
              style={{ background: '#FEE500', color: '#333' }}
            >
              🟡 카카오 공유
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
