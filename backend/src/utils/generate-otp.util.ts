import crypto from 'crypto'

/**
 * Sinh mã OTP bằng Crypto (Chuẩn an toàn nhất)
 * @param length Độ dài của mã OTP (mặc định là 6)
 */
export const generateSecureOTP = (length: number = 6): string => {
  if (length <= 0) throw new Error('Độ dài OTP phải lớn hơn 0')

  const min = Math.pow(10, length - 1) // Ví dụ length=6 -> 100000
  const max = Math.pow(10, length) - 1 // Ví dụ length=6 -> 999999

  // randomInt sẽ sinh ra một số nguyên cực kỳ ngẫu nhiên và an toàn
  // Cộng 1 vào max vì randomInt(min, max) sẽ không bao gồm giá trị max
  return crypto
    .randomInt(min, max + 1)
    .toString()
    .padStart(length, '0')
}
