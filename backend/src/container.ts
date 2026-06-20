/**
 * Dependency Injection Container
 * Manages instantiation and wiring of repositories and services
 */

import { UserRepository } from './repositories/user.repository'
import { TransactionRepository } from './repositories/transaction.repository'
import { ReportRepository } from './repositories/report.repository'
import { ReportSettingRepository } from './repositories/report-setting.repository'
import { RefreshTokenRepository } from './repositories/refresh-token.repository'
import { ImportBatchRepository } from './repositories/import-batch.repository'

import { IUserRepository } from './repositories/interfaces/user-repository.interface'
import { ITransactionRepository } from './repositories/interfaces/transaction-repository.interface'
import { IReportRepository } from './repositories/interfaces/report-repository.interface'
import { IReportSettingRepository } from './repositories/interfaces/report-setting-repository.interface'
import { IRefreshTokenRepository } from './repositories/interfaces/refresh-token-repository.interface'
import { IImportBatchRepository } from './repositories/interfaces/import-batch-repository.interface'

import { UserService } from './services/user.service'
import { TransactionService } from './services/transaction.service'
import { ReportService } from './services/report.service'
import { AnalyticsService } from './services/analytics.service'

/**
 * Dependency Injection Container
 * Provides singleton instances of repositories and services
 */
class Container {
  // Repository instances (singletons)
  private readonly _userRepository: IUserRepository
  private readonly _transactionRepository: ITransactionRepository
  private readonly _reportRepository: IReportRepository
  private readonly _reportSettingRepository: IReportSettingRepository
  private readonly _refreshTokenRepository: IRefreshTokenRepository
  private readonly _importBatchRepository: IImportBatchRepository

  // Service instances (singletons)
  private readonly _userService: UserService
  private readonly _transactionService: TransactionService
  private readonly _reportService: ReportService
  private readonly _analyticsService: AnalyticsService

  constructor() {
    // Initialize all repositories
    this._userRepository = new UserRepository()
    this._transactionRepository = new TransactionRepository()
    this._reportRepository = new ReportRepository()
    this._reportSettingRepository = new ReportSettingRepository()
    this._refreshTokenRepository = new RefreshTokenRepository()
    this._importBatchRepository = new ImportBatchRepository()

    // Initialize services with repository dependencies
    this._userService = new UserService(this._userRepository)
    this._transactionService = new TransactionService(
      this._transactionRepository,
      this._importBatchRepository
    )
    this._reportService = new ReportService(
      this._reportRepository,
      this._reportSettingRepository
    )
    this._analyticsService = new AnalyticsService(this._transactionRepository)
  }

  // ─── Repository Getters ───────────────────────────────────────────────────

  /**
   * Get UserRepository instance
   * Used by: UserService, AuthService, cron jobs
   */
  getUserRepository(): IUserRepository {
    return this._userRepository
  }

  /**
   * Get TransactionRepository instance
   * Used by: TransactionService, AnalyticsService, cron jobs
   */
  getTransactionRepository(): ITransactionRepository {
    return this._transactionRepository
  }

  /**
   * Get ReportRepository instance
   * Used by: ReportService, cron jobs
   */
  getReportRepository(): IReportRepository {
    return this._reportRepository
  }

  /**
   * Get ReportSettingRepository instance
   * Used by: ReportService, cron jobs
   */
  getReportSettingRepository(): IReportSettingRepository {
    return this._reportSettingRepository
  }

  /**
   * Get RefreshTokenRepository instance
   * Used by: AuthService, UserService, cron jobs
   */
  getRefreshTokenRepository(): IRefreshTokenRepository {
    return this._refreshTokenRepository
  }

  /**
   * Get ImportBatchRepository instance
   * Used by: TransactionService, workers, cron jobs
   */
  getImportBatchRepository(): IImportBatchRepository {
    return this._importBatchRepository
  }

  // ─── Service Getters ──────────────────────────────────────────────────────

  /**
   * Get UserService instance
   * Used by: UserController, AuthController
   */
  getUserService(): UserService {
    return this._userService
  }

  /**
   * Get TransactionService instance
   * Used by: TransactionController
   */
  getTransactionService(): TransactionService {
    return this._transactionService
  }

  /**
   * Get ReportService instance
   * Used by: ReportController
   */
  getReportService(): ReportService {
    return this._reportService
  }

  /**
   * Get AnalyticsService instance
   * Used by: AnalyticsController
   */
  getAnalyticsService(): AnalyticsService {
    return this._analyticsService
  }

  /**
   * Get AuthService instance
   * TODO: Implement in Phase 2 - Service Migration
   */
  // getAuthService(): AuthService {
  //   return this._authService
  // }
}

// Export singleton instance
export const container = new Container()
