import { ChevronDown, LogOut } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'

export function UserNav({
  userName,
  profilePicture,
  onLogout
}: {
  userName: string
  profilePicture: string
  onLogout: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 rounded-full !bg-transparent px-1.5 !gap-1 text-white hover:!bg-white/10 hover:!text-white"
        >
          <Avatar className="h-8 w-8 !cursor-pointer">
            <AvatarImage
              src={profilePicture || ''}
              className="!cursor-pointer"
            />
            <AvatarFallback
              className="!bg-[var(--secondary-dark-color)] border !border-gray-700
               !text-white"
            >
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="!h-3 !w-3 text-white/80" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 !bg-[var(--secondary-dark-color)] !text-white
         !border-gray-700
        "
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="flex flex-col items-start gap-1">
          <span className="font-semibold">{userName}</span>
          <span className="text-[13px] text-gray-400 font-light">
            Free Trial
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="!bg-gray-700" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="hover:!bg-gray-800 hover:!text-white"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
