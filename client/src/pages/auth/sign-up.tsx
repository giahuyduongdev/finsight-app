import SignUpForm from './_component/signup-form'
import Logo from '@/components/logo/logo'
import dashboardImg from '../../assets/images/dashboard_.png'
import dashboardImgDark from '../../assets/images/dashboard_dark.png'
import { useTheme } from '@/context/theme-provider'

const SignUp = () => {
  const { theme } = useTheme()
  return (
    <div className="grid min-h-svh lg:grid-cols-2 bg-slate-50 dark:bg-background">
      {/* Cột trái - Form Đăng ký */}
      <div className="flex flex-col gap-4 p-6 md:p-10 md:pt-6">
        <div className="flex justify-center gap-2 md:justify-start">
          <Logo url="/" />
        </div>

        <div className="flex flex-1 items-center justify-center">
          {/* Khung Form Đăng ký */}
          <div className="w-full max-w-md p-8 sm:p-10 bg-white dark:bg-zinc-950 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
            <SignUpForm />
          </div>
        </div>
      </div>

      {/* Cột phải - Hero Section */}
      <div className="relative hidden lg:flex flex-col bg-slate-50 dark:bg-muted/30 border-l border-slate-200 dark:border-none overflow-hidden">
        {/* Phần Text */}
        <div className="pt-20 px-12 xl:px-20 z-10">
          <h1 className="text-4xl xl:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
            Hi, I'm your AI-powered personal finance app,{' '}
            <span className="text-green-600">Finsight!</span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-muted-foreground max-w-xl">
            Finsight provides insights, monthly reports, CSV import, recurring
            transactions, all powered by advanced AI technology. 🚀
          </p>
        </div>

        {/* Phần Hình ảnh Dashboard */}
        <div className="relative flex-1 mt-12 pl-12 xl:pl-20">
          <div className="absolute top-0 left-12 xl:left-20 right-[-5%] bottom-[-5%]">
            <img
              src={theme === 'dark' ? dashboardImgDark : dashboardImg}
              alt="Dashboard"
              className="w-full h-full object-cover object-left-top"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignUp
