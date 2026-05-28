import { UserWithoutPassword } from '../types/user.type'
import { UserResponseDTO } from '../types/dto.type'

/**
 * Mapper function: Convert internal User type to API response DTO
 * Transforms MongoDB document to JSON-friendly format for client
 */
export const sanitizeUser = (user: UserWithoutPassword): UserResponseDTO => {
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
