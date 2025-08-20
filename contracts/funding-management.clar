;; Academic Research Collaboration Networks - Funding Management Contract
;; Manages grant allocation, fund distribution, and financial transparency

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u300))
(define-constant ERR-GRANT-NOT-FOUND (err u301))
(define-constant ERR-INSUFFICIENT-FUNDS (err u302))
(define-constant ERR-INVALID-ALLOCATION (err u303))
(define-constant ERR-MILESTONE-NOT-MET (err u304))
(define-constant ERR-INVALID-PERCENTAGE (err u305))
(define-constant ERR-GRANT-ALREADY-EXISTS (err u306))
(define-constant ERR-INVALID-STATUS (err u307))
(define-constant ERR-DISBURSEMENT-NOT-FOUND (err u308))
(define-constant ERR-EXPENSE-NOT-FOUND (err u309))
(define-constant ERR-BUDGET-EXCEEDED (err u310))

;; Grant status constants
(define-constant STATUS-PENDING u0)
(define-constant STATUS-ACTIVE u1)
(define-constant STATUS-COMPLETED u2)
(define-constant STATUS-SUSPENDED u3)
(define-constant STATUS-TERMINATED u4)

;; Disbursement status constants
(define-constant DISBURSEMENT-PENDING u0)
(define-constant DISBURSEMENT-APPROVED u1)
(define-constant DISBURSEMENT-RELEASED u2)
(define-constant DISBURSEMENT-REJECTED u3)

;; Expense category constants
(define-constant CATEGORY-PERSONNEL u0)
(define-constant CATEGORY-EQUIPMENT u1)
(define-constant CATEGORY-SUPPLIES u2)
(define-constant CATEGORY-TRAVEL u3)
(define-constant CATEGORY-INDIRECT u4)
(define-constant CATEGORY-OTHER u5)

;; Data structures
(define-map grants
  { grant-id: uint }
  {
    title: (string-ascii 256),
    description: (string-ascii 1024),
    funding-agency: (string-ascii 128),
    total-amount: uint,
    remaining-amount: uint,
    start-date: uint,
    end-date: uint,
    status: uint,
    principal-investigator: principal,
    agreement-id: (optional uint),
    created-at: uint,
    updated-at: uint
  }
)

(define-map institutional-allocations
  { grant-id: uint, institution: principal }
  {
    allocated-amount: uint,
    disbursed-amount: uint,
    remaining-amount: uint,
    allocation-percentage: uint,
    budget-categories: (list 6 { category: uint, amount: uint }),
    approved-by: (optional principal),
    last-updated: uint
  }
)

(define-map milestone-disbursements
  { grant-id: uint, milestone-id: uint }
  {
    description: (string-ascii 512),
    target-amount: uint,
    target-date: uint,
    status: uint,
    requirements: (string-ascii 1024),
    completion-evidence: (optional (string-ascii 512)),
    approved-by: (optional principal),
    disbursed-at: (optional uint)
  }
)

(define-map expense-records
  { grant-id: uint, expense-id: uint }
  {
    institution: principal,
    category: uint,
    amount: uint,
    description: (string-ascii 512),
    receipt-hash: (optional (buff 32)),
    date-incurred: uint,
    approved: bool,
    approved-by: (optional principal),
    created-at: uint
  }
)

(define-map budget-reports
  { grant-id: uint, report-period: uint }
  {
    reporting-institution: principal,
    period-start: uint,
    period-end: uint,
    total-expenses: uint,
    category-breakdown: (list 6 { category: uint, amount: uint }),
    variance-analysis: (string-ascii 1024),
    submitted-at: uint,
    reviewed: bool,
    reviewer: (optional principal)
  }
)

(define-map financial-audits
  { grant-id: uint, audit-id: uint }
  {
    auditor: principal,
    audit-type: (string-ascii 64),
    findings: (string-ascii 2048),
    recommendations: (string-ascii 1024),
    compliance-score: uint,
    audit-date: uint,
    follow-up-required: bool,
    status: (string-ascii 32)
  }
)

;; Global state
(define-data-var next-grant-id uint u1)
(define-data-var next-expense-id uint u1)
(define-data-var next-audit-id uint u1)
(define-data-var contract-owner principal tx-sender)

;; Private functions
(define-private (is-valid-status (status uint))
  (or (is-eq status STATUS-PENDING)
      (or (is-eq status STATUS-ACTIVE)
          (or (is-eq status STATUS-COMPLETED)
              (or (is-eq status STATUS-SUSPENDED)
                  (is-eq status STATUS-TERMINATED))))))

(define-private (is-valid-category (category uint))
  (or (is-eq category CATEGORY-PERSONNEL)
      (or (is-eq category CATEGORY-EQUIPMENT)
          (or (is-eq category CATEGORY-SUPPLIES)
              (or (is-eq category CATEGORY-TRAVEL)
                  (or (is-eq category CATEGORY-INDIRECT)
                      (is-eq category CATEGORY-OTHER)))))))

(define-private (calculate-total-percentage (allocations (list 10 { institution: principal, percentage: uint })))
  (fold + (map get-percentage allocations) u0))

(define-private (get-percentage (allocation { institution: principal, percentage: uint }))
  (get percentage allocation))

(define-private (can-manage-grant (grant-id uint) (caller principal))
  (match (map-get? grants { grant-id: grant-id })
    grant (is-eq (get principal-investigator grant) caller)
    false))

(define-private (has-institutional-access (grant-id uint) (institution principal))
  (is-some (map-get? institutional-allocations { grant-id: grant-id, institution: institution })))

;; Public functions

;; Create a new grant
(define-public (create-grant
  (title (string-ascii 256))
  (description (string-ascii 1024))
  (funding-agency (string-ascii 128))
  (total-amount uint)
  (start-date uint)
  (end-date uint)
  (agreement-id (optional uint)))
  (let ((grant-id (var-get next-grant-id)))
    (asserts! (> total-amount u0) ERR-INVALID-ALLOCATION)
    (asserts! (> end-date start-date) ERR-INVALID-STATUS)

    (map-set grants
      { grant-id: grant-id }
      {
        title: title,
        description: description,
        funding-agency: funding-agency,
        total-amount: total-amount,
        remaining-amount: total-amount,
        start-date: start-date,
        end-date: end-date,
        status: STATUS-PENDING,
        principal-investigator: tx-sender,
        agreement-id: agreement-id,
        created-at: block-height,
        updated-at: block-height
      })

    (var-set next-grant-id (+ grant-id u1))
    (ok grant-id)))

;; Allocate funds to institutions
(define-public (allocate-funds
  (grant-id uint)
  (allocations (list 10 { institution: principal, percentage: uint, budget-categories: (list 6 { category: uint, amount: uint }) })))
  (let ((grant (unwrap! (map-get? grants { grant-id: grant-id }) ERR-GRANT-NOT-FOUND)))
    (asserts! (can-manage-grant grant-id tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (calculate-total-percentage (map extract-allocation-percentage allocations)) u100) ERR-INVALID-PERCENTAGE)

    ;; Set allocations for each institution
    (fold process-allocation allocations grant-id)

    (ok true)))

(define-private (extract-allocation-percentage (allocation { institution: principal, percentage: uint, budget-categories: (list 6 { category: uint, amount: uint }) }))
  { institution: (get institution allocation), percentage: (get percentage allocation) })

(define-private (process-allocation
  (allocation { institution: principal, percentage: uint, budget-categories: (list 6 { category: uint, amount: uint }) })
  (grant-id uint))
  (let ((grant (unwrap-panic (map-get? grants { grant-id: grant-id })))
        (allocated-amount (/ (* (get total-amount grant) (get percentage allocation)) u100)))

    (map-set institutional-allocations
      { grant-id: grant-id, institution: (get institution allocation) }
      {
        allocated-amount: allocated-amount,
        disbursed-amount: u0,
        remaining-amount: allocated-amount,
        allocation-percentage: (get percentage allocation),
        budget-categories: (get budget-categories allocation),
        approved-by: (some tx-sender),
        last-updated: block-height
      })

    grant-id))

;; Create milestone-based disbursement
(define-public (create-milestone-disbursement
  (grant-id uint)
  (milestone-id uint)
  (description (string-ascii 512))
  (target-amount uint)
  (target-date uint)
  (requirements (string-ascii 1024)))
  (begin
    (asserts! (is-some (map-get? grants { grant-id: grant-id })) ERR-GRANT-NOT-FOUND)
    (asserts! (can-manage-grant grant-id tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (> target-amount u0) ERR-INVALID-ALLOCATION)

    (map-set milestone-disbursements
      { grant-id: grant-id, milestone-id: milestone-id }
      {
        description: description,
        target-amount: target-amount,
        target-date: target-date,
        status: DISBURSEMENT-PENDING,
        requirements: requirements,
        completion-evidence: none,
        approved-by: none,
        disbursed-at: none
      })

    (ok true)))

;; Submit milestone completion
(define-public (submit-milestone-completion
  (grant-id uint)
  (milestone-id uint)
  (completion-evidence (string-ascii 512)))
  (let ((disbursement (unwrap! (map-get? milestone-disbursements { grant-id: grant-id, milestone-id: milestone-id }) ERR-DISBURSEMENT-NOT-FOUND)))
    (asserts! (can-manage-grant grant-id tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status disbursement) DISBURSEMENT-PENDING) ERR-INVALID-STATUS)

    (map-set milestone-disbursements
      { grant-id: grant-id, milestone-id: milestone-id }
      (merge disbursement {
        completion-evidence: (some completion-evidence),
        status: DISBURSEMENT-APPROVED
      }))

    (ok true)))

;; Approve and release milestone funds
(define-public (release-milestone-funds (grant-id uint) (milestone-id uint))
  (let ((disbursement (unwrap! (map-get? milestone-disbursements { grant-id: grant-id, milestone-id: milestone-id }) ERR-DISBURSEMENT-NOT-FOUND))
        (grant (unwrap! (map-get? grants { grant-id: grant-id }) ERR-GRANT-NOT-FOUND)))
    (asserts! (can-manage-grant grant-id tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (is-eq (get status disbursement) DISBURSEMENT-APPROVED) ERR-INVALID-STATUS)
    (asserts! (>= (get remaining-amount grant) (get target-amount disbursement)) ERR-INSUFFICIENT-FUNDS)

    ;; Update disbursement status
    (map-set milestone-disbursements
      { grant-id: grant-id, milestone-id: milestone-id }
      (merge disbursement {
        status: DISBURSEMENT-RELEASED,
        approved-by: (some tx-sender),
        disbursed-at: (some block-height)
      }))

    ;; Update grant remaining amount
    (map-set grants
      { grant-id: grant-id }
      (merge grant {
        remaining-amount: (- (get remaining-amount grant) (get target-amount disbursement)),
        updated-at: block-height
      }))

    (ok true)))

;; Record expense
(define-public (record-expense
  (grant-id uint)
  (institution principal)
  (category uint)
  (amount uint)
  (description (string-ascii 512))
  (receipt-hash (optional (buff 32)))
  (date-incurred uint))
  (let ((expense-id (var-get next-expense-id))
        (allocation (unwrap! (map-get? institutional-allocations { grant-id: grant-id, institution: institution }) ERR-GRANT-NOT-FOUND)))
    (asserts! (has-institutional-access grant-id institution) ERR-NOT-AUTHORIZED)
    (asserts! (is-valid-category category) ERR-INVALID-ALLOCATION)
    (asserts! (>= (get remaining-amount allocation) amount) ERR-BUDGET-EXCEEDED)

    (map-set expense-records
      { grant-id: grant-id, expense-id: expense-id }
      {
        institution: institution,
        category: category,
        amount: amount,
        description: description,
        receipt-hash: receipt-hash,
        date-incurred: date-incurred,
        approved: false,
        approved-by: none,
        created-at: block-height
      })

    (var-set next-expense-id (+ expense-id u1))
    (ok expense-id)))

;; Approve expense
(define-public (approve-expense (grant-id uint) (expense-id uint))
  (let ((expense (unwrap! (map-get? expense-records { grant-id: grant-id, expense-id: expense-id }) ERR-EXPENSE-NOT-FOUND))
        (allocation (unwrap! (map-get? institutional-allocations { grant-id: grant-id, institution: (get institution expense) }) ERR-GRANT-NOT-FOUND)))
    (asserts! (can-manage-grant grant-id tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (not (get approved expense)) ERR-INVALID-STATUS)

    ;; Update expense approval
    (map-set expense-records
      { grant-id: grant-id, expense-id: expense-id }
      (merge expense {
        approved: true,
        approved-by: (some tx-sender)
      }))

    ;; Update institutional allocation
    (map-set institutional-allocations
      { grant-id: grant-id, institution: (get institution expense) }
      (merge allocation {
        disbursed-amount: (+ (get disbursed-amount allocation) (get amount expense)),
        remaining-amount: (- (get remaining-amount allocation) (get amount expense)),
        last-updated: block-height
      }))

    (ok true)))

;; Submit budget report
(define-public (submit-budget-report
  (grant-id uint)
  (report-period uint)
  (period-start uint)
  (period-end uint)
  (total-expenses uint)
  (category-breakdown (list 6 { category: uint, amount: uint }))
  (variance-analysis (string-ascii 1024)))
  (begin
    (asserts! (has-institutional-access grant-id tx-sender) ERR-NOT-AUTHORIZED)

    (map-set budget-reports
      { grant-id: grant-id, report-period: report-period }
      {
        reporting-institution: tx-sender,
        period-start: period-start,
        period-end: period-end,
        total-expenses: total-expenses,
        category-breakdown: category-breakdown,
        variance-analysis: variance-analysis,
        submitted-at: block-height,
        reviewed: false,
        reviewer: none
      })

    (ok true)))

;; Conduct financial audit
(define-public (conduct-audit
  (grant-id uint)
  (audit-type (string-ascii 64))
  (findings (string-ascii 2048))
  (recommendations (string-ascii 1024))
  (compliance-score uint))
  (let ((audit-id (var-get next-audit-id)))
    (asserts! (can-manage-grant grant-id tx-sender) ERR-NOT-AUTHORIZED)
    (asserts! (<= compliance-score u100) ERR-INVALID-PERCENTAGE)

    (map-set financial-audits
      { grant-id: grant-id, audit-id: audit-id }
      {
        auditor: tx-sender,
        audit-type: audit-type,
        findings: findings,
        recommendations: recommendations,
        compliance-score: compliance-score,
        audit-date: block-height,
        follow-up-required: (< compliance-score u80),
        status: "completed"
      })

    (var-set next-audit-id (+ audit-id u1))
    (ok audit-id)))

;; Read-only functions

;; Get grant details
(define-read-only (get-grant (grant-id uint))
  (map-get? grants { grant-id: grant-id }))

;; Get institutional allocation
(define-read-only (get-allocation (grant-id uint) (institution principal))
  (map-get? institutional-allocations { grant-id: grant-id, institution: institution }))

;; Get milestone disbursement
(define-read-only (get-milestone-disbursement (grant-id uint) (milestone-id uint))
  (map-get? milestone-disbursements { grant-id: grant-id, milestone-id: milestone-id }))

;; Get expense record
(define-read-only (get-expense (grant-id uint) (expense-id uint))
  (map-get? expense-records { grant-id: grant-id, expense-id: expense-id }))

;; Get budget report
(define-read-only (get-budget-report (grant-id uint) (report-period uint))
  (map-get? budget-reports { grant-id: grant-id, report-period: report-period }))

;; Get audit details
(define-read-only (get-audit (grant-id uint) (audit-id uint))
  (map-get? financial-audits { grant-id: grant-id, audit-id: audit-id }))

;; Check if institution has access
(define-read-only (has-access (grant-id uint) (institution principal))
  (has-institutional-access grant-id institution))

;; Get next IDs
(define-read-only (get-next-grant-id)
  (var-get next-grant-id))

(define-read-only (get-next-expense-id)
  (var-get next-expense-id))

(define-read-only (get-next-audit-id)
  (var-get next-audit-id))

;; Get contract owner
(define-read-only (get-contract-owner)
  (var-get contract-owner))
