import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import { useAppStore } from '../store';
import { recipeAPI, shoppingAPI, ingredientAPI } from '../services/api';
import { CUISINE_LABELS, TYPE_LABELS, DIFFICULTY_LABELS } from '../types';
import type { Recipe } from '../types';
import CookingTimer from '../components/CookingTimer';
import toast from 'react-hot-toast';

function estimateCalories(recipe: Recipe): number {
  const base: Record<string, number> = {
    Main: 580, Side: 270, Soup: 200, Snack: 220, Dessert: 310,
  };
  const b = base[recipe.recipe_type] ?? 400;
  const hash = recipe.recipe_title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variance = (hash % 201) - 100;
  return Math.round((b + variance) / 10) * 10;
}

export default function RecipeDetailPage() {
  const navigate = useNavigate();
  const {
    selectedRecipe,
    ingredients,
    setIngredients,
    addSavedRecipe,
    cookingSession,
    startCooking,
    updateCookingProgress,
    clearCookingSession,
    setCookingJustCompleted,
  } = useAppStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [addingToCart, setAddingToCart] = useState<Set<string>>(new Set());
  const [addedToCart, setAddedToCart] = useState<Set<string>>(new Set());
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [savedHistoryId, setSavedHistoryId] = useState<string | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const recipe = selectedRecipe;

  if (!recipe) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg" style={{ color: 'var(--text-muted)' }}>레시피를 찾을 수 없어요.</p>
        <button onClick={() => navigate('/recommend')} className="mt-4 px-6 py-3 rounded-2xl text-white" style={{ background: 'var(--primary)' }}>
          돌아가기
        </button>
      </div>
    );
  }

  const isMyCookingSession = cookingSession?.recipe.recipe_title === recipe.recipe_title;
  const completedSteps: Set<number> = new Set(isMyCookingSession ? cookingSession!.completedSteps : []);
  const activeStep: number | null = isMyCookingSession ? cookingSession!.activeStep : null;

  const missingIngredients = recipe.ingredient_list
    .filter((ri) => !ingredients.some((fi) => fi.name === ri.name))
    .filter((ri) => !addedToCart.has(ri.name))
    .map((ri) => ri.name);

  const handleStepComplete = (stepNumber: number) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(stepNumber);
    const nextStep = stepNumber + 1 <= recipe.steps.length ? stepNumber + 1 : null;
    if (isMyCookingSession) {
      updateCookingProgress(Array.from(newCompleted), nextStep);
    }
    if (nextStep) {
      setTimeout(() => {
        document.getElementById(`step-${nextStep}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  };

  const handleSaveRecipe = async () => {
    setIsSaving(true);
    try {
      await recipeAPI.save(recipe);
      addSavedRecipe(recipe); // persist to local store → visible in 마이리피
      toast.success(
        (t) => (
          <div className="flex items-center gap-3">
            <span>🔖 레시피 저장 완료!</span>
            <button onClick={() => { toast.dismiss(t.id); navigate('/myripe'); }}
              className="text-xs font-bold underline" style={{ color: 'var(--primary)' }}>마이리피 →</button>
          </div>
        ), { duration: 4000 }
      );
    } catch { toast.error('저장 중 오류가 발생했습니다.'); }
    finally { setIsSaving(false); }
  };

  const handleShowCompletionSheet = async () => {
    setIsCompleting(true);
    try {
      const historyRes = await recipeAPI.save(recipe);
      setSavedHistoryId(historyRes.data.id);
    } catch {
      // Save failed — still show sheet; green points won't be awarded but deduction proceeds
      setSavedHistoryId(null);
    } finally {
      setIsCompleting(false);
      setShowCompletionSheet(true);
    }
  };

  const handleFinishCompletion = async (saveForLater: boolean) => {
    setShowCompletionSheet(false);
    setIsCompleting(true);
    try {
      const usedIngredients = recipe.ingredient_list
        .filter((ri) => ingredients.find((fi) => fi.name === ri.name))
        .map((ri) => {
          const found = ingredients.find((fi) => fi.name === ri.name);
          return { name: ri.name, urgency: found?.urgency?.urgency_score || 0.2 };
        });
      let pts = 0;
      if (savedHistoryId) {
        const res = await recipeAPI.complete(savedHistoryId, usedIngredients);
        pts = res.data.green_points_earned;
      }
      const toDeduct = recipe.ingredient_list
        .filter((ri) => ingredients.some((fi) => fi.name === ri.name))
        .map((ri) => ({ name: ri.name, quantity: ri.quantity ? parseFloat(ri.quantity as unknown as string) : undefined }));
      if (toDeduct.length > 0) {
        await ingredientAPI.deduct(toDeduct);
        const refreshed = await ingredientAPI.getAll();
        setIngredients(refreshed.data.ingredients);
      }
      clearCookingSession();
      if (saveForLater) addSavedRecipe(recipe);
      if (pts > 0) setCookingJustCompleted({ points: pts });
      toast.success(pts > 0 ? `🌿 요리 완성! +${pts} 그린포인트 적립!` : '🎉 요리 완성! 냉장고 재료가 차감됐어요.', { duration: 4000 });
      if (saveForLater) toast('📌 저장한 레시피에 추가됐어요', { icon: '🔖', duration: 2000 });
      navigate('/');
    } catch { toast.error('처리 중 오류가 발생했습니다.'); }
    finally { setIsCompleting(false); }
  };

  const handleAddSingleToCart = async (ingredientName: string) => {
    setAddingToCart((prev) => new Set(prev).add(ingredientName));
    try {
      await shoppingAPI.addItem({ ingredient_name: ingredientName, recipe_title: recipe.recipe_title });
      // 담기 성공 → 부족한 재료 목록에서 제거 후 쇼핑 페이지로 이동
      setAddedToCart((prev) => new Set(prev).add(ingredientName));
      navigate('/shopping');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      if (e?.response?.data?.error?.includes('이미')) {
        // 이미 있어도 목록에서 제거하고 이동
        setAddedToCart((prev) => new Set(prev).add(ingredientName));
        navigate('/shopping');
      } else {
        toast.error('쇼핑 리스트 추가 중 오류가 발생했습니다.');
      }
    } finally {
      setAddingToCart((prev) => { const next = new Set(prev); next.delete(ingredientName); return next; });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      `🥗 ${recipe.recipe_title} | 재료 ${Math.round((recipe.match_score || 0) * 100)}% 보유 | 리버스 레시피 앱`
    ).then(() => toast.success('📋 텍스트 복사 완료!'));
  };
  const handleShareX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🥗 ${recipe.recipe_title}\n재료 ${Math.round((recipe.match_score || 0) * 100)}% 활용! #리버스레시피 #오늘의요리`)}`, '_blank');
  };
  const handleShareKakao = () => {
    toast('카카오톡 공유는 카카오 SDK 연동 후 사용 가능해요', { icon: '💬', duration: 3000 });
  };
  const handleSystemShare = async () => {
    setShowShareSheet(false);
    if (navigator.share) {
      try {
        await navigator.share({ title: `🥗 ${recipe.recipe_title}`, text: `냉장고 재료 ${Math.round((recipe.match_score || 0) * 100)}% 활용! 리버스 레시피 앱.` });
      } catch (err: unknown) {
        if ((err as Error).name !== 'AbortError') toast.error('공유 중 오류.');
      }
    } else { handleCopyLink(); }
  };
  const handleDownloadImage = async () => {
    if (!shareCardRef.current) return;
    setShowShareSheet(false);
    try {
      const canvas = await html2canvas(shareCardRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${recipe.recipe_title}.png`;
      link.click();
      toast.success('📸 이미지 저장 완료!');
    } catch { toast.error('이미지 저장 중 오류가 발생했습니다.'); }
  };

  const allStepsCompleted = completedSteps.size === recipe.steps.length && recipe.steps.length > 0;
  const progressPercent = recipe.steps.length > 0 ? (completedSteps.size / recipe.steps.length) * 100 : 0;

  return (
    <div className="py-6 space-y-5">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)', minHeight: '44px' }}>
        ← 돌아가기
      </button>

      {/* Hero card */}
      <div ref={shareCardRef}>
        <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}>
          <div className="flex flex-wrap gap-x-2 gap-y-2 mb-4">
            {[CUISINE_LABELS[recipe.cuisine_type], TYPE_LABELS[recipe.recipe_type], DIFFICULTY_LABELS[recipe.difficulty], `⏱️ ${recipe.estimated_total_time_minutes}분`, `~${estimateCalories(recipe)} kcal`].map((tag) => (
              <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/20 text-white">{tag}</span>
            ))}
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">{recipe.recipe_title}</h1>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-white/30 overflow-hidden">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.round((recipe.match_score || 0) * 100)}%` }} />
            </div>
            <span className="text-white/90 text-sm font-medium">{Math.round((recipe.match_score || 0) * 100)}%</span>
          </div>
          <p className="text-white/60 text-xs mt-3">🌿 Reverse Recipe 앱에서 만들었어요</p>
        </div>
      </div>

      {/* Progress */}
      {recipe.steps.length > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span style={{ color: 'var(--text-muted)' }}>조리 진행도</span>
            <span style={{ color: 'var(--primary)' }}>{completedSteps.size}/{recipe.steps.length} 단계</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <motion.div animate={{ width: `${progressPercent}%` }} className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #16A34A, #22C55E)' }} />
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div className="rounded-2xl p-5 border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text)' }}>📋 재료</h2>
        <div className="space-y-2">
          {recipe.ingredient_list.map((ing) => {
            const inFridge = ingredients.some((fi) => fi.name === ing.name);
            return (
              <div key={ing.name} className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{inFridge ? '✅' : '❌'}</span>
                  <span className="text-sm font-medium" style={{ color: inFridge ? 'var(--text)' : '#9CA3AF' }}>{ing.name}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{ing.quantity} {ing.unit}</span>
              </div>
            );
          })}
        </div>

        {missingIngredients.length > 0 && (
          <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid #FDE68A' }}>
            <div className="px-4 py-3" style={{ background: '#FFFBEB' }}>
              <p className="text-sm font-semibold" style={{ color: '#D97706' }}>⚠️ 부족한 재료 ({missingIngredients.length}개)</p>
            </div>
            {missingIngredients.map((name) => (
              <div key={name} className="flex items-center justify-between px-4 py-3 border-t" style={{ background: 'var(--surface)', borderColor: '#FEF3C7' }}>
                <span className="text-sm font-medium" style={{ color: '#92400E' }}>{name}</span>
                <button
                  onClick={() => handleAddSingleToCart(name)}
                  disabled={addingToCart.has(name)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{ background: addingToCart.has(name) ? 'var(--surface-2)' : '#FEF3C7', color: addingToCart.has(name) ? 'var(--text-subtle)' : '#D97706', minHeight: '32px' }}
                >
                  {addingToCart.has(name) ? '추가 중...' : '담기'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Steps */}
      <div>
        <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text)' }}>🍳 조리 순서</h2>

        {/* Start Cooking CTA — just before step 1 */}
        {!isMyCookingSession && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => startCooking(recipe)}
            className="w-full py-4 rounded-2xl text-white font-bold text-base mb-5"
            style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}
          >
            요리 시작하기
          </motion.button>
        )}
        {isMyCookingSession && (
          <div className="px-4 py-2.5 rounded-2xl flex items-center gap-2 mb-5"
            style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-medium)' }}>
            <span style={{ color: 'var(--primary)' }}>🍳</span>
            <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
              요리 진행 중 — {completedSteps.size}/{recipe.steps.length} 단계 완료
            </p>
          </div>
        )}

        <div className="space-y-12">
          {recipe.steps.map((step) => {
            const isCompleted = completedSteps.has(step.step_number);
            const isActive = activeStep === step.step_number || (!activeStep && step.step_number === 1);
            const refIngredients = recipe.ingredient_list.filter((ing) => step.instruction.includes(ing.name));
            return (
              <motion.div
                key={step.step_number}
                id={`step-${step.step_number}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: step.step_number * 0.05 }}
                className="rounded-2xl p-5 border transition-all"
                style={{
                  background: isCompleted ? '#F0FDF4' : isActive ? 'var(--surface-3)' : 'var(--surface)',
                  borderColor: isCompleted ? '#BBF7D0' : isActive ? 'var(--primary)' : 'var(--border)',
                  borderWidth: isActive ? '2px' : '1px',
                }}
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => { if (!isCompleted) handleStepComplete(step.step_number); }}
                    className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden"
                    style={{
                      background: isCompleted ? '#10B981' : isActive ? 'var(--primary)' : 'var(--surface-2)',
                      color: isCompleted || isActive ? 'white' : 'var(--text-muted)',
                      minHeight: '40px',
                      minWidth: '40px',
                    }}
                    aria-label={`${step.step_number}단계 완료`}
                  >
                    {isCompleted ? '✓' : step.step_number}
                  </button>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm leading-relaxed" style={{ color: isCompleted ? '#9CA3AF' : 'var(--text)', textDecoration: isCompleted ? 'line-through' : 'none', lineHeight: '1.7', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
                      {step.instruction}
                    </p>
                    {!isCompleted && refIngredients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {refIngredients.map((ing) => (
                          <span key={ing.name} className="px-2 py-0.5 rounded-full text-xs"
                            style={{
                              background: ingredients.some(fi => fi.name === ing.name) ? 'var(--primary-light)' : '#FEF3C7',
                              color: ingredients.some(fi => fi.name === ing.name) ? 'var(--primary)' : '#D97706',
                            }}>
                            {ing.name} {ing.quantity}{ing.unit}
                          </span>
                        ))}
                      </div>
                    )}
                    {step.time_seconds && step.time_seconds > 0 && !isCompleted && (
                      <CookingTimer seconds={step.time_seconds} stepNumber={step.step_number} onComplete={() => handleStepComplete(step.step_number)} />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-3 pb-4">
        {/* Finish button — available as soon as cooking started */}
        {isMyCookingSession && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            onClick={handleShowCompletionSheet}
            disabled={isCompleting}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg"
            style={{ background: allStepsCompleted
              ? 'linear-gradient(135deg, #16A34A, #22C55E)'
              : 'linear-gradient(135deg, #16A34A, #4ADE80)' }}
          >
            {isCompleting ? '처리 중...' : allStepsCompleted ? '🎉 요리 완성! 그린포인트 받기' : '✅ 요리 완성하기'}
          </motion.button>
        )}
        <button onClick={handleSaveRecipe} disabled={isSaving} className="w-full py-3.5 rounded-2xl font-semibold border-2" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
          {isSaving ? '저장 중...' : '🔖 레시피 저장'}
        </button>
        <button onClick={() => setShowShareSheet(true)} className="w-full py-3.5 rounded-2xl font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          📤 레시피 카드 공유하기
        </button>
      </div>

      {/* Completion Sheet */}
      <AnimatePresence>
        {showCompletionSheet && (
          <>
            <motion.div className="bottom-sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCompletionSheet(false)} />
            <motion.div className="bottom-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              <div className="mx-auto mb-5 rounded-full" style={{ width: 40, height: 4, background: 'var(--border)' }} />
              <div className="text-center mb-5">
                <div className="text-5xl mb-3">🍽️</div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>맛있게 드셨나요?</h2>
                <p className="text-sm mt-1.5" style={{ color: 'var(--text-muted)' }}>다시 드셔보실래요?</p>
              </div>
              <div className="rounded-2xl p-4 mb-5" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--primary)' }}>🌿 냉장고 재료 자동 차감</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>사용한 재료 {recipe.ingredient_list.filter(ri => ingredients.some(fi => fi.name === ri.name)).length}가지가 냉장고에서 차감돼요.</p>
              </div>
              <div className="space-y-3">
                <button onClick={() => handleFinishCompletion(true)} className="w-full py-4 rounded-2xl text-white font-bold" style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}>
                  네, 다음에 또 만들게요 🌿
                </button>
                <button onClick={() => handleFinishCompletion(false)} className="w-full py-4 rounded-2xl font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  아니요, 완성만 할게요
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Share Sheet */}
      <AnimatePresence>
        {showShareSheet && (
          <>
            <motion.div className="bottom-sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShareSheet(false)} />
            <motion.div className="bottom-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              <div className="mx-auto mb-5 rounded-full" style={{ width: 40, height: 4, background: 'var(--border)' }} />
              <h2 className="text-lg font-bold text-center mb-6" style={{ color: 'var(--text)' }}>공유하기</h2>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { icon: '📋', label: '링크 복사', action: handleCopyLink },
                  { icon: '🐦', label: 'X (트위터)', action: handleShareX },
                  { icon: '💬', label: '카카오톡', action: handleShareKakao },
                  { icon: '📤', label: '기타 앱', action: handleSystemShare },
                ].map((item) => (
                  <button key={item.label} onClick={() => { setShowShareSheet(false); setTimeout(item.action, 200); }}
                    className="flex flex-col items-center gap-2" style={{ minHeight: '44px' }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'var(--surface-2)' }}>
                      {item.icon}
                    </div>
                    <span className="text-xs text-center" style={{ color: 'var(--text-muted)', lineHeight: '1.2' }}>{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text)' }}>📸 인스타그램 스토리</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>아래 이미지 저장 후 인스타그램 스토리에 업로드하세요</p>
              </div>
              <button onClick={handleDownloadImage} className="w-full py-4 rounded-2xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, #F97316, #FBBF24)' }}>
                💾 레시피 카드 이미지 저장
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
