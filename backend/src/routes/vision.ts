/**
 * Phase 2: 사진 인식 재료 등록
 * - POST /api/ocr/receipt  → 영수증 OCR
 * - POST /api/vision/fridge → 냉장고 사진 인식
 */
import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import axios from 'axios';

const router = Router();

// POST /api/vision/fridge — Refrigerator photo recognition
router.post('/fridge', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { image_base64 } = req.body;

    if (!image_base64) {
      res.status(400).json({ error: '이미지 데이터가 필요합니다.' });
      return;
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_KEY) {
      // Mock response for demo
      res.json({
        detected_items: [
          { name: '계란', estimated_quantity: 6, unit: '개', category: '기타' },
          { name: '우유', estimated_quantity: 1, unit: 'L', category: '유제품' },
          { name: '당근', estimated_quantity: 2, unit: '개', category: '채소' },
          { name: '양파', estimated_quantity: 3, unit: '개', category: '채소' },
          { name: '버터', estimated_quantity: 100, unit: 'g', category: '유제품' },
        ],
      });
      return;
    }

    // GPT-4o Vision
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this refrigerator photo. List all visible food ingredients.
For each item return: name (Korean preferred), estimated_quantity (number), unit (string), category (one of: 채소/과일/육류/해산물/유제품/조미료/소스/기타).
Output as JSON array only. Example: [{"name":"계란","estimated_quantity":6,"unit":"개","category":"기타"}]`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${image_base64}` },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    res.json({ detected_items: items });
  } catch (error) {
    console.error('Vision API error:', error);
    res.status(500).json({ error: '이미지 분석 중 오류가 발생했습니다.' });
  }
});

// POST /api/ocr/receipt — Receipt OCR
router.post('/receipt', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { image_base64 } = req.body;

    if (!image_base64) {
      res.status(400).json({ error: '이미지 데이터가 필요합니다.' });
      return;
    }

    // Mock OCR result for demo (replace with Google Cloud Vision or CLOVA OCR)
    const mockItems = [
      { name: '계란', quantity: 1, unit: '판', suggested_category: '기타' },
      { name: '우유', quantity: 1, unit: 'L', suggested_category: '유제품' },
      { name: '닭가슴살', quantity: 200, unit: 'g', suggested_category: '육류' },
    ];

    res.json({ parsed_items: mockItems });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: '영수증 분석 중 오류가 발생했습니다.' });
  }
});

export default router;
