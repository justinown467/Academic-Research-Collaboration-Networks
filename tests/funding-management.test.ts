import { describe, it, expect, beforeEach } from "vitest"

describe("Funding Management Contract", () => {
  let contractState
  let mockPrincipals
  
  beforeEach(() => {
    contractState = {
      grants: new Map(),
      institutionalAllocations: new Map(),
      milestoneDisbursements: new Map(),
      expenseRecords: new Map(),
      budgetReports: new Map(),
      nextGrantId: 1,
      nextExpenseId: 1,
    }
    
    mockPrincipals = {
      pi: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      institution1: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      institution2: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
    }
  })
  
  describe("Grant Creation", () => {
    it("should create grant successfully", () => {
      const grantData = {
        title: "NSF AI Research Grant",
        description: "Multi-year funding for AI research collaboration",
        fundingAgency: "National Science Foundation",
        totalAmount: 1000000,
        startDate: Date.now(),
        endDate: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        agreementId: 1,
      }
      
      const result = createGrant(grantData)
      
      expect(result.success).toBe(true)
      expect(result.grantId).toBe(1)
      expect(contractState.grants.has(1)).toBe(true)
      
      const grant = contractState.grants.get(1)
      expect(grant.title).toBe(grantData.title)
      expect(grant.totalAmount).toBe(grantData.totalAmount)
      expect(grant.remainingAmount).toBe(grantData.totalAmount)
      expect(grant.status).toBe(0) // STATUS-PENDING
    })
    
    it("should fail with invalid amount", () => {
      const grantData = {
        title: "Invalid Grant",
        description: "Test grant",
        fundingAgency: "Test Agency",
        totalAmount: 0,
        startDate: Date.now(),
        endDate: Date.now() + 1000,
        agreementId: null,
      }
      
      const result = createGrant(grantData)
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR-INVALID-ALLOCATION")
    })
    
    it("should fail with invalid date range", () => {
      const grantData = {
        title: "Invalid Grant",
        description: "Test grant",
        fundingAgency: "Test Agency",
        totalAmount: 100000,
        startDate: Date.now(),
        endDate: Date.now() - 1000, // End before start
        agreementId: null,
      }
      
      const result = createGrant(grantData)
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR-INVALID-STATUS")
    })
  })
  
  describe("Fund Allocation", () => {
    beforeEach(() => {
      const grantData = {
        title: "Test Grant",
        description: "Test description",
        fundingAgency: "Test Agency",
        totalAmount: 1000000,
        startDate: Date.now(),
        endDate: Date.now() + 1000000,
        agreementId: null,
      }
      createGrant(grantData)
    })
    
    it("should allocate funds successfully", () => {
      const allocations = [
        {
          institution: mockPrincipals.institution1,
          percentage: 60,
          budgetCategories: [
            { category: 0, amount: 300000 }, // Personnel
            { category: 1, amount: 200000 }, // Equipment
            { category: 2, amount: 100000 }, // Supplies
          ],
        },
        {
          institution: mockPrincipals.institution2,
          percentage: 40,
          budgetCategories: [
            { category: 0, amount: 200000 }, // Personnel
            { category: 3, amount: 100000 }, // Travel
            { category: 4, amount: 100000 }, // Indirect
          ],
        },
      ]
      
      const result = allocateFunds(1, allocations)
      
      expect(result.success).toBe(true)
      expect(contractState.institutionalAllocations.has(`1-${mockPrincipals.institution1}`)).toBe(true)
      expect(contractState.institutionalAllocations.has(`1-${mockPrincipals.institution2}`)).toBe(true)
      
      const allocation1 = contractState.institutionalAllocations.get(`1-${mockPrincipals.institution1}`)
      expect(allocation1.allocatedAmount).toBe(600000)
      expect(allocation1.allocationPercentage).toBe(60)
    })
    
    it("should fail with invalid percentage total", () => {
      const allocations = [
        {
          institution: mockPrincipals.institution1,
          percentage: 70,
          budgetCategories: [],
        },
        {
          institution: mockPrincipals.institution2,
          percentage: 40, // Total = 110%
          budgetCategories: [],
        },
      ]
      
      const result = allocateFunds(1, allocations)
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR-INVALID-PERCENTAGE")
    })
  })
  
  describe("Milestone Disbursements", () => {
    beforeEach(() => {
      const grantData = {
        title: "Test Grant",
        description: "Test description",
        fundingAgency: "Test Agency",
        totalAmount: 1000000,
        startDate: Date.now(),
        endDate: Date.now() + 1000000,
        agreementId: null,
      }
      createGrant(grantData)
    })
    
    it("should create milestone disbursement successfully", () => {
      const result = createMilestoneDisbursement(
          1,
          1,
          "Phase 1 Completion",
          250000,
          Date.now() + 100000,
          "Complete initial research phase and submit progress report",
      )
      
      expect(result.success).toBe(true)
      expect(contractState.milestoneDisbursements.has("1-1")).toBe(true)
      
      const disbursement = contractState.milestoneDisbursements.get("1-1")
      expect(disbursement.description).toBe("Phase 1 Completion")
      expect(disbursement.targetAmount).toBe(250000)
      expect(disbursement.status).toBe(0) // DISBURSEMENT-PENDING
    })
    
    it("should submit milestone completion successfully", () => {
      createMilestoneDisbursement(1, 1, "Test Milestone", 100000, Date.now() + 100000, "Test requirements")
      
      const result = submitMilestoneCompletion(1, 1, "Research phase completed successfully with all deliverables met")
      
      expect(result.success).toBe(true)
      
      const disbursement = contractState.milestoneDisbursements.get("1-1")
      expect(disbursement.completionEvidence).toBe("Research phase completed successfully with all deliverables met")
      expect(disbursement.status).toBe(1) // DISBURSEMENT-APPROVED
    })
    
    it("should release milestone funds successfully", () => {
      createMilestoneDisbursement(1, 1, "Test Milestone", 100000, Date.now() + 100000, "Test requirements")
      submitMilestoneCompletion(1, 1, "Completed")
      
      const result = releaseMilestoneFunds(1, 1)
      
      expect(result.success).toBe(true)
      
      const disbursement = contractState.milestoneDisbursements.get("1-1")
      expect(disbursement.status).toBe(2) // DISBURSEMENT-RELEASED
      
      const grant = contractState.grants.get(1)
      expect(grant.remainingAmount).toBe(900000) // 1000000 - 100000
    })
    
    it("should fail to release funds with insufficient balance", () => {
      createMilestoneDisbursement(1, 1, "Large Milestone", 1500000, Date.now() + 100000, "Test requirements")
      submitMilestoneCompletion(1, 1, "Completed")
      
      const result = releaseMilestoneFunds(1, 1)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR-INSUFFICIENT-FUNDS")
    })
  })
  
  describe("Expense Management", () => {
    beforeEach(() => {
      const grantData = {
        title: "Test Grant",
        description: "Test description",
        fundingAgency: "Test Agency",
        totalAmount: 1000000,
        startDate: Date.now(),
        endDate: Date.now() + 1000000,
        agreementId: null,
      }
      createGrant(grantData)
      
      const allocations = [
        {
          institution: mockPrincipals.institution1,
          percentage: 100,
          budgetCategories: [{ category: 0, amount: 1000000 }],
        },
      ]
      allocateFunds(1, allocations)
    })
    
    it("should record expense successfully", () => {
      const result = recordExpense(
          1,
          mockPrincipals.institution1,
          0,
          50000,
          "Research assistant salary",
          "receipt-hash-123",
          Date.now(),
      )
      
      expect(result.success).toBe(true)
      expect(result.expenseId).toBe(1)
      expect(contractState.expenseRecords.has("1-1")).toBe(true)
      
      const expense = contractState.expenseRecords.get("1-1")
      expect(expense.amount).toBe(50000)
      expect(expense.category).toBe(0) // Personnel
      expect(expense.approved).toBe(false)
    })
    
    it("should approve expense successfully", () => {
      recordExpense(1, mockPrincipals.institution1, 0, 50000, "Test expense", null, Date.now())
      
      const result = approveExpense(1, 1)
      
      expect(result.success).toBe(true)
      
      const expense = contractState.expenseRecords.get("1-1")
      expect(expense.approved).toBe(true)
      
      const allocation = contractState.institutionalAllocations.get(`1-${mockPrincipals.institution1}`)
      expect(allocation.disbursedAmount).toBe(50000)
      expect(allocation.remainingAmount).toBe(950000)
    })
    
    it("should fail to record expense exceeding budget", () => {
      const result = recordExpense(1, mockPrincipals.institution1, 0, 1500000, "Excessive expense", null, Date.now())
      
      expect(result.success).toBe(false)
      expect(result.error).toBe("ERR-BUDGET-EXCEEDED")
    })
  })
  
  describe("Budget Reporting", () => {
    beforeEach(() => {
      const grantData = {
        title: "Test Grant",
        description: "Test description",
        fundingAgency: "Test Agency",
        totalAmount: 1000000,
        startDate: Date.now(),
        endDate: Date.now() + 1000000,
        agreementId: null,
      }
      createGrant(grantData)
      
      const allocations = [
        {
          institution: mockPrincipals.institution1,
          percentage: 100,
          budgetCategories: [{ category: 0, amount: 1000000 }],
        },
      ]
      allocateFunds(1, allocations)
    })
    
    it("should submit budget report successfully", () => {
      const categoryBreakdown = [
        { category: 0, amount: 75000 }, // Personnel
        { category: 1, amount: 25000 }, // Equipment
        { category: 2, amount: 10000 }, // Supplies
      ]
      
      const result = submitBudgetReport(
          1,
          1,
          Date.now() - 100000,
          Date.now(),
          110000,
          categoryBreakdown,
          "Expenses are within expected ranges for this reporting period",
      )
      
      expect(result.success).toBe(true)
      expect(contractState.budgetReports.has("1-1")).toBe(true)
      
      const report = contractState.budgetReports.get("1-1")
      expect(report.totalExpenses).toBe(110000)
      expect(report.categoryBreakdown).toHaveLength(3)
      expect(report.reviewed).toBe(false)
    })
  })
  
  // Mock contract functions
  function createGrant(data) {
    if (data.totalAmount <= 0) {
      return { success: false, error: "ERR-INVALID-ALLOCATION" }
    }
    if (data.endDate <= data.startDate) {
      return { success: false, error: "ERR-INVALID-STATUS" }
    }
    
    const grantId = contractState.nextGrantId++
    contractState.grants.set(grantId, {
      ...data,
      remainingAmount: data.totalAmount,
      status: 0,
      principalInvestigator: mockPrincipals.pi,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    
    return { success: true, grantId }
  }
  
  function allocateFunds(grantId, allocations) {
    if (!contractState.grants.has(grantId)) {
      return { success: false, error: "ERR-GRANT-NOT-FOUND" }
    }
    
    const totalPercentage = allocations.reduce((sum, alloc) => sum + alloc.percentage, 0)
    if (totalPercentage !== 100) {
      return { success: false, error: "ERR-INVALID-PERCENTAGE" }
    }
    
    const grant = contractState.grants.get(grantId)
    
    allocations.forEach((allocation) => {
      const allocatedAmount = Math.floor((grant.totalAmount * allocation.percentage) / 100)
      
      contractState.institutionalAllocations.set(`${grantId}-${allocation.institution}`, {
        allocatedAmount,
        disbursedAmount: 0,
        remainingAmount: allocatedAmount,
        allocationPercentage: allocation.percentage,
        budgetCategories: allocation.budgetCategories,
        approvedBy: mockPrincipals.pi,
        lastUpdated: Date.now(),
      })
    })
    
    return { success: true }
  }
  
  function createMilestoneDisbursement(grantId, milestoneId, description, targetAmount, targetDate, requirements) {
    if (!contractState.grants.has(grantId)) {
      return { success: false, error: "ERR-GRANT-NOT-FOUND" }
    }
    if (targetAmount <= 0) {
      return { success: false, error: "ERR-INVALID-ALLOCATION" }
    }
    
    contractState.milestoneDisbursements.set(`${grantId}-${milestoneId}`, {
      description,
      targetAmount,
      targetDate,
      status: 0, // DISBURSEMENT-PENDING
      requirements,
      completionEvidence: null,
      approvedBy: null,
      disbursedAt: null,
    })
    
    return { success: true }
  }
  
  function submitMilestoneCompletion(grantId, milestoneId, completionEvidence) {
    const key = `${grantId}-${milestoneId}`
    if (!contractState.milestoneDisbursements.has(key)) {
      return { success: false, error: "ERR-DISBURSEMENT-NOT-FOUND" }
    }
    
    const disbursement = contractState.milestoneDisbursements.get(key)
    if (disbursement.status !== 0) {
      return { success: false, error: "ERR-INVALID-STATUS" }
    }
    
    disbursement.completionEvidence = completionEvidence
    disbursement.status = 1 // DISBURSEMENT-APPROVED
    
    return { success: true }
  }
  
  function releaseMilestoneFunds(grantId, milestoneId) {
    const key = `${grantId}-${milestoneId}`
    if (!contractState.milestoneDisbursements.has(key)) {
      return { success: false, error: "ERR-DISBURSEMENT-NOT-FOUND" }
    }
    
    const disbursement = contractState.milestoneDisbursements.get(key)
    if (disbursement.status !== 1) {
      return { success: false, error: "ERR-INVALID-STATUS" }
    }
    
    const grant = contractState.grants.get(grantId)
    if (grant.remainingAmount < disbursement.targetAmount) {
      return { success: false, error: "ERR-INSUFFICIENT-FUNDS" }
    }
    
    disbursement.status = 2 // DISBURSEMENT-RELEASED
    disbursement.approvedBy = mockPrincipals.pi
    disbursement.disbursedAt = Date.now()
    
    grant.remainingAmount -= disbursement.targetAmount
    grant.updatedAt = Date.now()
    
    return { success: true }
  }
  
  function recordExpense(grantId, institution, category, amount, description, receiptHash, dateIncurred) {
    const allocationKey = `${grantId}-${institution}`
    if (!contractState.institutionalAllocations.has(allocationKey)) {
      return { success: false, error: "ERR-GRANT-NOT-FOUND" }
    }
    
    const allocation = contractState.institutionalAllocations.get(allocationKey)
    if (allocation.remainingAmount < amount) {
      return { success: false, error: "ERR-BUDGET-EXCEEDED" }
    }
    
    const expenseId = contractState.nextExpenseId++
    contractState.expenseRecords.set(`${grantId}-${expenseId}`, {
      institution,
      category,
      amount,
      description,
      receiptHash,
      dateIncurred,
      approved: false,
      approvedBy: null,
      createdAt: Date.now(),
    })
    
    return { success: true, expenseId }
  }
  
  function approveExpense(grantId, expenseId) {
    const key = `${grantId}-${expenseId}`
    if (!contractState.expenseRecords.has(key)) {
      return { success: false, error: "ERR-EXPENSE-NOT-FOUND" }
    }
    
    const expense = contractState.expenseRecords.get(key)
    if (expense.approved) {
      return { success: false, error: "ERR-INVALID-STATUS" }
    }
    
    expense.approved = true
    expense.approvedBy = mockPrincipals.pi
    
    // Update allocation
    const allocationKey = `${grantId}-${expense.institution}`
    const allocation = contractState.institutionalAllocations.get(allocationKey)
    allocation.disbursedAmount += expense.amount
    allocation.remainingAmount -= expense.amount
    allocation.lastUpdated = Date.now()
    
    return { success: true }
  }
  
  function submitBudgetReport(
      grantId,
      reportPeriod,
      periodStart,
      periodEnd,
      totalExpenses,
      categoryBreakdown,
      varianceAnalysis,
  ) {
    const allocationKey = `${grantId}-${mockPrincipals.institution1}`
    if (!contractState.institutionalAllocations.has(allocationKey)) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    contractState.budgetReports.set(`${grantId}-${reportPeriod}`, {
      reportingInstitution: mockPrincipals.institution1,
      periodStart,
      periodEnd,
      totalExpenses,
      categoryBreakdown,
      varianceAnalysis,
      submittedAt: Date.now(),
      reviewed: false,
      reviewer: null,
    })
    
    return { success: true }
  }
})
