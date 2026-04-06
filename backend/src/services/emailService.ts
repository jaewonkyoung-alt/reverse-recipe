import nodemailer from 'nodemailer';

// Gmail 발신 설정 — .env에서 읽어옴
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // 예: yourname@gmail.com
    pass: process.env.GMAIL_PASS,   // Gmail 앱 비밀번호 (16자리)
  },
});

/** 6자리 숫자 인증코드 생성 */
export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 인증 이메일 발송 */
export async function sendVerificationEmail(toEmail: string, code: string): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    // 이메일 설정 없으면 콘솔에 출력 (개발용)
    console.log(`\n[개발모드] 인증코드 발송 생략`);
    console.log(`  → 수신: ${toEmail}`);
    console.log(`  → 코드: ${code}\n`);
    return;
  }

  await transporter.sendMail({
    from: `"리버스 레시피" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: '[리버스 레시피] 이메일 인증번호',
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: #16A34A; padding: 28px 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">🥗 리버스 레시피</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 13px;">냉장고 속 재료로 레시피를 찾아드려요</p>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="color: #374151; font-size: 15px; margin: 0 0 24px;">안녕하세요! 회원가입 인증번호입니다.</p>
          <div style="background: #F0FDF4; border: 2px solid #16A34A; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <p style="color: #6B7280; font-size: 12px; margin: 0 0 8px; letter-spacing: 1px;">인증번호 (5분 유효)</p>
            <p style="color: #16A34A; font-size: 36px; font-weight: 800; margin: 0; letter-spacing: 8px;">${code}</p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; margin: 0; line-height: 1.7;">
            본인이 요청하지 않은 경우 이 메일을 무시해주세요.<br>
            인증번호는 발송 후 5분간 유효합니다.
          </p>
        </div>
      </div>
    `,
  });
}
