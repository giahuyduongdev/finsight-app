import { UserDocument } from '../models/user.model' // Nhớ trỏ đúng đường dẫn file model của bạn

// 1. Định nghĩa Type chuẩn xác trả về cho Frontend
export interface UserResponseDTO {
  id: string
  name: string
  email: string
  profilePicture: string | null // Khớp với Schema của bạn
  timezone: string
  preferredCurrency: string
  role: string
}

type SanitizeUserInput = Omit<UserDocument, 'password'>
// 2. Hàm "Làm sạch" và ép kiểu dữ liệu
export const sanitizeUser = (user: SanitizeUserInput): UserResponseDTO => {
  // Đảm bảo user là một plain object (phòng trường hợp Mongoose Document)
  // Nếu bạn đã gọi .lean() ở query thì không cần, nhưng cứ để đây cho an toàn tuyệt đối
  const userData = user.toObject ? user.toObject() : user

  return {
    id: userData._id.toString(), // Đổi _id (ObjectId) sang id (String) cho Frontend dễ dùng
    name: userData.name,
    email: userData.email,
    profilePicture: userData.profilePicture || null,
    timezone: userData.timezone,
    preferredCurrency: userData.preferredCurrency,
    role: userData.role
  }
}
