// Định nghĩa cấu trúc chuẩn của một User trên Frontend (Đã loại bỏ password)
export interface User {
  _id: string
  name: string
  email: string
  profilePicture: string | null
  role: string // Nếu bên FE bạn có RoleUserEnum thì thay string bằng RoleUserEnum
  preferredCurrency: string // Tương tự, có thể dùng CurrencyEnum
  timezone: string
  auth0Ids: string[]
  createdAt: string // Trả về qua JSON sẽ là dạng ISO String
  updatedAt: string // Trả về qua JSON sẽ là dạng ISO String
  __v?: number // Version key của Mongoose (có thể có hoặc không cần thiết dùng)
}

// Định nghĩa cấu trúc của toàn bộ cục Response từ API /current-user
export interface GetCurrentUserResponse {
  message: string
  user: User
}
