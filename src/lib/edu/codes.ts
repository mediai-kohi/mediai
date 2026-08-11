import { randomBytes, randomInt } from 'node:crypto'

// 혼동되는 0/O, 1/I/L 제외 — 참가자 코드 수동 입력 폴백을 고려한 문자셋
const PARTICIPANT_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateParticipantCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += PARTICIPANT_CODE_CHARS[randomInt(PARTICIPANT_CODE_CHARS.length)]
  }
  return code
}

export function generateCourseSlug() {
  return randomBytes(9).toString('base64url')
}
