$ErrorActionPreference = 'Stop'

$base = 'http://localhost:5000/api'
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$wardBase = 400 + ($stamp % 200)
$results = [ordered]@{}

function Step {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  try {
    $value = & $Action
    $results[$Name] = @{
      ok = $true
      value = $value
    }
    return $value
  } catch {
    $details = $_.ErrorDetails.Message
    if (-not $details) {
      $details = $_.Exception.Message
    }

    $results[$Name] = @{
      ok = $false
      error = $details
    }

    throw "Step failed: $Name`n$details"
  }
}

function Login {
  param([string]$Email, [string]$Password)

  return Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body (@{
      email = $Email
      password = $Password
    } | ConvertTo-Json)
}

function AuthHeaders {
  param($LoginResponse)

  return @{ Authorization = 'Bearer ' + $LoginResponse.token }
}

function RegisterUser {
  param([hashtable]$Payload)

  return Invoke-RestMethod -Method Post -Uri "$base/auth/register" -ContentType 'application/json' -Body ($Payload | ConvertTo-Json)
}

function JsonPost {
  param([string]$Uri, [hashtable]$Headers, [hashtable]$Body)

  return Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8)
}

function JsonPatch {
  param([string]$Uri, [hashtable]$Headers, [hashtable]$Body)

  return Invoke-RestMethod -Method Patch -Uri $Uri -Headers $Headers -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8)
}

function JsonPut {
  param([string]$Uri, [hashtable]$Headers, [object]$Body)

  return Invoke-RestMethod -Method Put -Uri $Uri -Headers $Headers -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 8)
}

function JsonGet {
  param([string]$Uri, [hashtable]$Headers)

  return Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers
}

Step 'health' {
  JsonGet -Uri "$base/health" -Headers @{}
}

$admin = Step 'login_admin' { Login 'admin@urbangrid.local' 'UrbanGrid@123' }
$ministry = Step 'login_ministry' { Login 'ministry@urbangrid.local' 'UrbanGrid@123' }
$department = Step 'login_department' { Login 'department@urbangrid.local' 'UrbanGrid@123' }
$senior = Step 'login_senior' { Login 'senior@urbangrid.local' 'UrbanGrid@123' }
$region = Step 'login_region' { Login 'region@urbangrid.local' 'UrbanGrid@123' }

$adminHeaders = AuthHeaders $admin
$ministryHeaders = AuthHeaders $ministry
$departmentHeaders = AuthHeaders $department
$seniorHeaders = AuthHeaders $senior
$regionHeaders = AuthHeaders $region

$wardComplaint = [string]$wardBase
$wardMaster = [string]($wardBase + 1)
$wardReject = [string]($wardBase + 2)

$residentEmail = "resident$stamp@example.com"
$voterEmail = "residentvoter$stamp@example.com"
$resident2Email = "residentextra$stamp@example.com"
$contractorAEmail = "contractora$stamp@example.com"
$contractorBEmail = "contractorb$stamp@example.com"

$residentRegister = Step 'register_resident' {
  RegisterUser @{
    name = 'Smoke Resident'
    email = $residentEmail
    password = 'Passw0rd!'
    role = 'citizen'
    address = "Ward $wardComplaint Main Street"
    pincode = [string](600000 + [int]$wardComplaint)
    wardNo = $wardComplaint
  }
}

$resident = Step 'login_resident' { Login $residentEmail 'Passw0rd!' }
$residentHeaders = AuthHeaders $resident

$voterRegister = Step 'register_voter_resident' {
  RegisterUser @{
    name = 'Smoke Voter'
    email = $voterEmail
    password = 'Passw0rd!'
    role = 'citizen'
    address = "Ward $wardComplaint Cross Street"
    pincode = [string](600000 + [int]$wardComplaint)
    wardNo = $wardComplaint
  }
}

$voter = Step 'login_voter_resident' { Login $voterEmail 'Passw0rd!' }
$voterHeaders = AuthHeaders $voter

$resident2Register = Step 'register_reject_resident' {
  RegisterUser @{
    name = 'Reject Resident'
    email = $resident2Email
    password = 'Passw0rd!'
    role = 'citizen'
    address = "Ward $wardReject Street"
    pincode = [string](600000 + [int]$wardReject)
    wardNo = $wardReject
  }
}

$resident2 = Step 'login_reject_resident' { Login $resident2Email 'Passw0rd!' }
$resident2Headers = AuthHeaders $resident2

$contractorARegister = Step 'register_contractor_a' {
  RegisterUser @{
    name = 'Smoke Contractor A'
    email = $contractorAEmail
    password = 'Passw0rd!'
    role = 'contractor'
    companyName = 'Smoke Infra A'
    registrationNumber = "REGA$stamp"
  }
}

$contractorA = Step 'login_contractor_a' { Login $contractorAEmail 'Passw0rd!' }
$contractorAHeaders = AuthHeaders $contractorA

$contractorBRegister = Step 'register_contractor_b' {
  RegisterUser @{
    name = 'Smoke Contractor B'
    email = $contractorBEmail
    password = 'Passw0rd!'
    role = 'contractor'
    companyName = 'Smoke Infra B'
    registrationNumber = "REGB$stamp"
  }
}

$contractorB = Step 'login_contractor_b' { Login $contractorBEmail 'Passw0rd!' }
$contractorBHeaders = AuthHeaders $contractorB

Step 'auth_refresh' { JsonPost -Uri "$base/auth/refresh" -Headers $residentHeaders -Body @{} }
Step 'auth_me' { JsonGet -Uri "$base/auth/me" -Headers $residentHeaders }
Step 'auth_profile_get' { JsonGet -Uri "$base/auth/me/profile" -Headers $residentHeaders }
Step 'auth_profile_patch' {
  JsonPatch -Uri "$base/auth/me/profile" -Headers $residentHeaders -Body @{
    phone = '9999999999'
    address = "Updated Ward $wardComplaint Main Street"
  }
}
Step 'auth_settings_get' { JsonGet -Uri "$base/auth/me/settings" -Headers $residentHeaders }
Step 'auth_settings_patch' {
  JsonPatch -Uri "$base/auth/me/settings" -Headers $residentHeaders -Body @{
    theme = 'dark'
    language = 'en'
    emailNotifications = $true
    smsNotifications = $false
    pushNotifications = $true
  }
}
Step 'auth_logout' { JsonPost -Uri "$base/auth/logout" -Headers $residentHeaders -Body @{} }

$complaintMain = Step 'resident_submit_complaint_main' {
  JsonPost -Uri "$base/citizen/complaints" -Headers $residentHeaders -Body @{
    title = "Complaint Flow $stamp"
    description = 'Road is badly damaged'
    category = 'road_damage'
    area = "Ward $wardComplaint Main Road"
    wardNo = $wardComplaint
  }
}
$complaintMainId = $complaintMain.complaint.id

$complaintReject = Step 'resident_submit_complaint_reject' {
  JsonPost -Uri "$base/citizen/complaints" -Headers $resident2Headers -Body @{
    title = "Reject Flow $stamp"
    description = 'Streetlight issue for reject path'
    category = 'streetlight_failure'
    area = "Ward $wardReject Lane"
    wardNo = $wardReject
  }
}
$complaintRejectId = $complaintReject.complaint.id

Step 'citizen_my_complaints' { JsonGet -Uri "$base/citizen/complaints/my" -Headers $residentHeaders }
Step 'citizen_ward_complaints' { JsonGet -Uri "$base/citizen/complaints/ward" -Headers $residentHeaders }
Step 'citizen_complaint_detail_before_verify' { JsonGet -Uri "$base/citizen/complaints/$complaintMainId" -Headers $residentHeaders }
Step 'citizen_vote' {
  JsonPost -Uri "$base/citizen/complaints/$complaintMainId/vote" -Headers $voterHeaders -Body @{ voteValue = 5 }
}
Step 'citizen_track_status_before_verify' { JsonGet -Uri "$base/citizen/complaints/$complaintMainId/status" -Headers $residentHeaders }

Step 'admin_pending_before_verify' { JsonGet -Uri "$base/admin/complaints/pending" -Headers $adminHeaders }
Step 'admin_all_before_verify' { JsonGet -Uri "$base/admin/complaints/all" -Headers $adminHeaders }
Step 'admin_stats_before_verify' { JsonGet -Uri "$base/admin/dashboard/stats" -Headers $adminHeaders }

Step 'admin_verify_main_complaint' {
  JsonPatch -Uri "$base/admin/complaints/$complaintMainId/verify" -Headers $adminHeaders -Body @{ notes = 'Verified in full smoke test' }
}
Step 'admin_route_main_complaint' {
  JsonPost -Uri "$base/admin/complaints/$complaintMainId/route" -Headers $adminHeaders -Body @{ ministryId = 1 }
}
Step 'admin_reject_other_complaint' {
  JsonPatch -Uri "$base/admin/complaints/$complaintRejectId/reject" -Headers $adminHeaders -Body @{ reason = 'Rejected in smoke test' }
}

Step 'ministry_get_complaints' { JsonGet -Uri "$base/ministry/complaints" -Headers $ministryHeaders }

$approvalTender = Step 'ministry_create_complaint_tender' {
  JsonPost -Uri "$base/ministry/tenders" -Headers $ministryHeaders -Body @{
    complaintId = $complaintMainId
    title = "Complaint Tender $stamp"
    description = 'Complaint-based tender for approval flow'
    estimatedBudget = 150000
    startDate = '2026-04-20'
    endDate = '2026-04-28'
    biddingDeadline = '2026-04-24'
  }
}
$approvalTenderId = $approvalTender.tender.id

Step 'approval_submit' { JsonPost -Uri "$base/approvals/tenders/$approvalTenderId/submit" -Headers $ministryHeaders -Body @{} }
Step 'approval_pending_department' { JsonGet -Uri "$base/approvals/pending" -Headers $departmentHeaders }
Step 'approval_approve_department' { JsonPost -Uri "$base/approvals/tenders/$approvalTenderId/approve" -Headers $departmentHeaders -Body @{ comments = 'Approved in smoke' } }
Step 'approval_history_department' { JsonGet -Uri "$base/approvals/history" -Headers $departmentHeaders }
Step 'approval_pending_senior' { JsonGet -Uri "$base/approvals/pending" -Headers $seniorHeaders }
Step 'approval_history_senior' { JsonGet -Uri "$base/approvals/history" -Headers $seniorHeaders }

$rejectTenderComplaint = Step 'resident_submit_reject_tender_complaint' {
  JsonPost -Uri "$base/citizen/complaints" -Headers $resident2Headers -Body @{
    title = "Approval Reject $stamp"
    description = 'Drainage issue for rejection flow'
    category = 'drainage'
    area = 'Ward 33 Drain'
    wardNo = $wardReject
  }
}
$rejectTenderComplaintId = $rejectTenderComplaint.complaint.id
Step 'admin_verify_reject_tender_complaint' {
  JsonPatch -Uri "$base/admin/complaints/$rejectTenderComplaintId/verify" -Headers $adminHeaders -Body @{ notes = 'Verify for rejection flow' }
}
$rejectTender = Step 'ministry_create_reject_tender' {
  JsonPost -Uri "$base/ministry/tenders" -Headers $ministryHeaders -Body @{
    complaintId = $rejectTenderComplaintId
    title = "Reject Tender $stamp"
    description = 'Tender to reject in approval flow'
    estimatedBudget = 125000
    startDate = '2026-04-20'
    endDate = '2026-04-29'
    biddingDeadline = '2026-04-24'
  }
}
$rejectTenderId = $rejectTender.tender.id
Step 'approval_submit_reject_tender' { JsonPost -Uri "$base/approvals/tenders/$rejectTenderId/submit" -Headers $ministryHeaders -Body @{} }
Step 'approval_reject_department' { JsonPost -Uri "$base/approvals/tenders/$rejectTenderId/reject" -Headers $departmentHeaders -Body @{ comments = 'Rejected in smoke' } }

Step 'ministry_get_tenders' { JsonGet -Uri "$base/ministry/tenders" -Headers $ministryHeaders }
Step 'ministry_get_single_tender' { JsonGet -Uri "$base/ministry/tenders/$approvalTenderId" -Headers $ministryHeaders }
Step 'ministry_publish_approval_tender' { Invoke-RestMethod -Method Patch -Uri "$base/ministry/tenders/$approvalTenderId/publish" -Headers $ministryHeaders }

Step 'contractor_available_tenders_after_publish' { JsonGet -Uri "$base/contractor/tenders/available" -Headers $contractorAHeaders }
$complaintTenderBid = Step 'contractor_bid_on_approval_tender' {
  JsonPost -Uri "$base/contractor/tenders/$approvalTenderId/bid" -Headers $contractorAHeaders -Body @{
    amount = 140000
    proposedStartDate = '2026-04-21'
    proposedEndDate = '2026-04-27'
    durationDays = 6
    proposal = 'Bid for complaint-based tender'
  }
}
$complaintTenderBidId = $complaintTenderBid.bid.id
Step 'contractor_get_bids' { JsonGet -Uri "$base/contractor/bids" -Headers $contractorAHeaders }
Step 'contractor_get_single_bid' { JsonGet -Uri "$base/contractor/bids/$complaintTenderBidId" -Headers $contractorAHeaders }
Step 'ministry_get_bids_for_approval_tender' { JsonGet -Uri "$base/ministry/tenders/$approvalTenderId/bids" -Headers $ministryHeaders }
Step 'project_assign_route_patch' {
  JsonPatch -Uri "$base/projects/$approvalTenderId/assign" -Headers $ministryHeaders -Body @{ bidId = $complaintTenderBidId }
}

$masterTender = Step 'admin_create_master_tender' {
  JsonPost -Uri "$base/ministry/tenders" -Headers $adminHeaders -Body @{
    title = "Master Tender $stamp"
    category = 'road_damage'
    wardNo = $wardMaster
    area = 'Ward 32 Main Road'
    estimatedBudget = 300000
    startDate = '2026-04-20'
    endDate = '2026-04-30'
    biddingDeadline = '2026-04-24'
  }
}
$masterTenderId = $masterTender.tender.id
Step 'admin_publish_master_tender' { Invoke-RestMethod -Method Patch -Uri "$base/ministry/tenders/$masterTenderId/publish" -Headers $adminHeaders }
Step 'contractor_available_tenders_master' { JsonGet -Uri "$base/contractor/tenders/available" -Headers $contractorBHeaders }
$masterBidA = Step 'contractor_a_bid_master' {
  JsonPost -Uri "$base/contractor/tenders/$masterTenderId/bid" -Headers $contractorAHeaders -Body @{
    amount = 280000
    proposedStartDate = '2026-04-21'
    proposedEndDate = '2026-04-29'
    durationDays = 8
    proposal = 'Contractor A bid on master tender'
  }
}
$masterBidB = Step 'contractor_b_bid_master' {
  JsonPost -Uri "$base/contractor/tenders/$masterTenderId/bid" -Headers $contractorBHeaders -Body @{
    amount = 260000
    proposedStartDate = '2026-04-21'
    proposedEndDate = '2026-04-28'
    durationDays = 7
    proposal = 'Contractor B bid on master tender'
  }
}
$masterBidBId = $masterBidB.bid.id
Step 'admin_view_master_bids' { JsonGet -Uri "$base/ministry/tenders/$masterTenderId/bids" -Headers $adminHeaders }
Step 'admin_select_master_winner' { JsonPost -Uri "$base/ministry/tenders/$masterTenderId/bids/$masterBidBId/select" -Headers $adminHeaders -Body @{} }

$masterProjectsAdmin = Step 'admin_get_projects' { JsonGet -Uri "$base/projects" -Headers $adminHeaders }
$masterProject = $masterProjectsAdmin.projects | Where-Object { (($_.tender.id) -eq $masterTenderId) -or ($_.tender -eq $masterTenderId) } | Select-Object -First 1
if (-not $masterProject) { throw 'Master project not found after winner selection' }
$masterProjectId = $masterProject.id

Step 'admin_get_single_project' { JsonGet -Uri "$base/projects/$masterProjectId" -Headers $adminHeaders }
Step 'admin_update_milestones' {
  JsonPut -Uri "$base/projects/$masterProjectId/milestones" -Headers $adminHeaders -Body @{
    milestones = @(
      @{ title = 'Survey'; description = 'Initial survey'; status = 'pending'; deadline = '2026-04-22' },
      @{ title = 'Repair'; description = 'Repair road'; status = 'pending'; deadline = '2026-04-27' }
    )
  }
}
Step 'admin_get_milestones' { JsonGet -Uri "$base/projects/$masterProjectId/milestones" -Headers $adminHeaders }

$residentMasterEmail = "residentmaster$stamp@example.com"
Step 'register_master_resident' {
  RegisterUser @{
    name = 'Master Resident'
    email = $residentMasterEmail
    password = 'Passw0rd!'
    role = 'citizen'
    address = 'Ward 32 Main Street'
    pincode = '323232'
    wardNo = $wardMaster
  }
}
$residentMaster = Step 'login_master_resident' { Login $residentMasterEmail 'Passw0rd!' }
$residentMasterHeaders = AuthHeaders $residentMaster

$linkedComplaint = Step 'resident_submit_linked_complaint' {
  JsonPost -Uri "$base/citizen/complaints" -Headers $residentMasterHeaders -Body @{
    title = "Linked Complaint $stamp"
    description = 'Road damage should route to awarded owner'
    category = 'road_damage'
    area = 'Ward 32 Main Road'
    wardNo = $wardMaster
  }
}
$linkedComplaintId = $linkedComplaint.complaint.id
Step 'resident_get_linked_complaint' { JsonGet -Uri "$base/citizen/complaints/$linkedComplaintId" -Headers $residentMasterHeaders }
Step 'resident_track_linked_status' { JsonGet -Uri "$base/citizen/complaints/$linkedComplaintId/status" -Headers $residentMasterHeaders }
Step 'contractor_b_projects' { JsonGet -Uri "$base/contractor/projects" -Headers $contractorBHeaders }
Step 'contractor_b_assigned_complaints' { JsonGet -Uri "$base/contractor/complaints" -Headers $contractorBHeaders }

Step 'contractor_b_update_progress' {
  JsonPost -Uri "$base/contractor/projects/$masterProjectId/progress" -Headers $contractorBHeaders -Body @{
    title = 'Weekly Update'
    description = 'Initial repair work started'
    percentageComplete = 45
    updateType = 'weekly'
  }
}
Step 'admin_get_progress_history' { JsonGet -Uri "$base/projects/$masterProjectId/progress" -Headers $adminHeaders }
Step 'contractor_b_mark_complete' {
  JsonPost -Uri "$base/contractor/projects/$masterProjectId/complete" -Headers $contractorBHeaders -Body @{
    completionNotes = 'Work completed and submitted'
  }
}
Step 'admin_pending_completion_projects' { JsonGet -Uri "$base/projects?status=pending_admin_verification" -Headers $adminHeaders }
Step 'admin_verify_completion_approve' {
  JsonPost -Uri "$base/projects/$masterProjectId/verify" -Headers $adminHeaders -Body @{
    recommendation = 'approve'
    findings = 'Looks good'
    issues = @()
    rating = 5
  }
}
Step 'resident_track_linked_status_after_resolution' { JsonGet -Uri "$base/citizen/complaints/$linkedComplaintId/status" -Headers $residentMasterHeaders }

Step 'admin_reports_generate' { JsonPost -Uri "$base/admin/reports/generate" -Headers $adminHeaders -Body @{ reportType = 'complaints' } }
Step 'admin_reports_list' { JsonGet -Uri "$base/admin/reports?limit=5" -Headers $adminHeaders }
$alerts = Step 'admin_alerts_list' { JsonGet -Uri "$base/admin/alerts?limit=5" -Headers $adminHeaders }
if ($alerts.alerts -and $alerts.alerts.Count -gt 0) {
  $firstAlertId = $alerts.alerts[0].id
  Step 'admin_resolve_first_alert' { Invoke-RestMethod -Method Patch -Uri "$base/admin/alerts/$firstAlertId/resolve" -Headers $adminHeaders }
}

Step 'region_get_projects' { JsonGet -Uri "$base/region/projects" -Headers $regionHeaders }
Step 'region_get_complaints' { JsonGet -Uri "$base/region/complaints" -Headers $regionHeaders }
Step 'region_monitor_master_project' { JsonGet -Uri "$base/region/projects/$masterProjectId/monitor" -Headers $regionHeaders }

[pscustomobject]@{
  ok = $true
  checked = $results
} | ConvertTo-Json -Depth 12
