import type { Locale } from "./locale-format";

const id = {
  status: {
    PENDING: "Menunggu",
    PAYMENT_REVIEW: "Pemeriksaan pembayaran",
    CONFIRMED: "Dikonfirmasi",
    CANCELLED: "Dibatalkan",
    EXPIRED: "Kedaluwarsa",
    VERIFIED: "Terverifikasi",
  },
  account: {
    accessActive: "Aktif",
    accessInactive: "Belum aktif",
    accountLabel: "AKUN",
    welcome: "Selamat datang, ",
    logOut: "Keluar",
    accountNavigation: "Navigasi akun",
    orders: "Pesanan",
    myTickets: "Tiket saya",
    bookTickets: "Pesan tiket",
    home: "Beranda",
    totalOrders: "Total pesanan",
    availablePDFs: "PDF tersedia",
    livestreamAccess: "Akses livestream",
    myOrders: "Pesanan saya",
    noOrdersYetChooseATicket:
      "Belum ada pesanan. Pilih kelas tiket saat penjualan dibuka.",
    orderLabel: "PESANAN",
    created: "Dibuat",
    expires: "Batas",
    cancelBooking: "Batalkan reservasi",
    transferTo: "Transfer ke",
    accountHolder: "a.n.",
    afterTransferringSubmitYourTransactionReference:
      "Setelah transfer, kirim referensi transaksi. Verifikasi dilakukan petugas setelah dana cocok dengan mutasi rekening.",
    transferReference: "Referensi transfer",
    submitForVerification: "Ajukan verifikasi",
    transferAwaitingStaffReviewTicketsAre:
      "Transfer menunggu pemeriksaan petugas. Tiket belum aktif.",
    bookingExpiredBookAgainIfTickets:
      "Reservasi berakhir. Silakan pesan kembali jika stok tersedia.",
    yourTicketPDFWillAppearAfter:
      "PDF tiket asli muncul setelah pembayaran diverifikasi.",
    eventDate: "7 Februari 2027",
    downloadOriginalPDF: "Unduh PDF asli",
    ticketsLabel: "TIKET",
    lookingForTickets: "Cari tiket?",
    exploreTickets: "Lihat tiket",
  },
  admin: {
    closeSales: "Tutup",
    openSales: "Buka",
    closedSales: "Tutup",
    operationsLabel: "OPERASIONAL",
    adminDashboard: "Pusat pengelolaan",
    transactionsAndInventoryFromTheDatabase:
      "Data transaksi dan inventaris dari database.",
    myAccount: "Akun saya",
    adminSections: "Modul admin",
    overview: "Ringkasan",
    inventory: "Inventaris",
    payments: "Pembayaran",
    donations: "Donasi",
    notifications: "Notifikasi",
    settings: "Pengaturan",
    users: "Pengguna",
    liveOverview: "Ringkasan langsung",
    confirmedOrders: "Pesanan terkonfirmasi",
    awaitingReview: "Menunggu verifikasi",
    verifiedDonations: "Donasi terverifikasi",
    ordersShowTheLatest100Transactions:
      "Daftar pesanan memuat 100 transaksi terbaru. Statistik dihitung dari seluruh transaksi.",
    exportOrdersCSV: "Ekspor pesanan CSV",
    exportDonationsCSV: "Ekspor donasi CSV",
    ticketClassesOriginals: "Kelas & tiket asli",
    class: "Kelas",
    capacity: "Kapasitas",
    available: "Tersedia",
    reserved: "Dipesan",
    sold: "Terjual",
    sales: "Penjualan",
    recentImports: "Riwayat impor terbaru",
    noPDFImportsYet: "Belum ada impor PDF.",
    time: "Waktu",
    needsReview: "Perlu review",
    importASinglePDF: "Impor PDF individual",
    useTheIssuerSManifestCode:
      "Gunakan kode dari manifest penerbit. PDF menunggu review sebelum tersedia untuk dijual.",
    venueClass: "Kelas venue",
    manifestQRBarcode: "Kode QR/barcode manifest",
    originalPDF: "PDF asli",
    uploadForReview: "Unggah untuk review",
    noPDFsAwaitingReview: "Belum ada PDF menunggu review.",
    code: "Kode",
    approveAgainstManifest: "Setujui sesuai manifest",
    checkInTickets: "Validasi tiket masuk",
    ticketsCheckedIn: "tiket sudah digunakan untuk masuk.",
    barcodeQRFromOriginalPDF: "Kode barcode/QR dari PDF asli",
    validateCheckIn: "Validasi & catat masuk",
    ordersTransfers: "Pesanan & transfer",
    searchNameEmailOrID: "Cari nama, email, atau ID",
    all: "Semua",
    applyFilters: "Terapkan filter",
    releaseExpiredBookings: "Lepaskan reservasi kedaluwarsa",
    noOrdersMatchTheseFilters: "Tidak ada pesanan sesuai filter.",
    expires: "Berakhir",
    customerReference: "Referensi pembeli",
    bankStatementReference: "Referensi mutasi bank",
    statementAmountRp: "Jumlah di mutasi (Rp)",
    matchesTheBankStatement: "Sudah cocok dengan mutasi rekening",
    verifyTransfer: "Verifikasi transfer",
    noDonationsAwaitingReview: "Tidak ada donasi menunggu verifikasi.",
    donorReference: "Referensi pembeli",
    verifyDonation: "Verifikasi donasi",
    whatsAppQueue: "Antrean WhatsApp",
    noNotificationsYet: "Belum ada notifikasi.",
    sendingStartsOnceOfficialWhatsAppCredentials:
      "Pengiriman aktif hanya setelah kredensial WhatsApp resmi dan template disiapkan.",
    streamControls: "Kontrol siaran",
    useTheOfficialYouTubeVideoID:
      "Gunakan ID video YouTube resmi. Pemutar hanya diberikan kepada akun yang memiliki hak akses terverifikasi.",
    youTubeVideoID: "ID video YouTube",
    notStarted: "Belum dimulai",
    ended: "Berakhir",
    saveStreamStatus: "Simpan status siaran",
    paymentAccount: "Rekening pembayaran",
    accountNumber: "Nomor rekening",
    accountHolder: "Atas nama",
    saveTransferInstructions: "Simpan instruksi transfer",
    usersRoles: "Pengguna & peran",
    latest50AccountsRoleChangesAre:
      "50 akun terbaru. Perubahan peran dicatat di audit log.",
    role: "Peran",
    saveRole: "Simpan peran",
  },
  donate: {
    donationsLabel: "DONASI",
    giveWithCare: "Kontribusi dengan kepedulian.",
    donationsAreRecordedSeparatelyFromTickets:
      "Donasi dicatat terpisah dari tiket dan baru dihitung setelah transfer dikonfirmasi petugas.",
    transferInstructions: "Instruksi transfer",
    account: "Rekening",
    accountHolder: "a.n.",
    enterYourTransferReferenceAfterPayment:
      "Masukkan referensi transfer setelah pembayaran. Jangan kirim donasi jika rekening tidak sesuai dengan informasi resmi penyelenggara.",
    donorName: "Nama donatur",
    donationAmountRp: "Jumlah donasi (Rp)",
    transferReference: "Referensi transfer",
    showMeAsAnonymousIfA:
      "Tampilkan sebagai anonim jika laporan publik diterbitkan",
    submitDonationForVerification: "Ajukan verifikasi donasi",
    donationsAreNotOpenYetOfficial:
      "Donasi belum dibuka. Instruksi rekening resmi masih disiapkan.",
    backToHome: "Kembali ke beranda",
  },
  donationStatus: {
    verifiedDescription:
      "Transfer telah diverifikasi dan tercatat sebagai dana diterima.",
    pendingDescription:
      "Referensi transfer tercatat. Petugas akan memeriksa mutasi rekening sebelum menghitung donasi ini.",
    unverifiedDescription:
      "Donasi belum terverifikasi. Hubungi penyelenggara melalui kanal resmi jika Anda telah transfer.",
    donationsLabel: "DONASI",
    yourDonationStatus: "Status kontribusi Anda.",
    reference: "Referensi",
    saveThisPageAddressToCheck:
      "Simpan alamat halaman ini untuk memeriksa status.",
    backToHome: "Kembali ke beranda",
  },
  livestream: {
    streamEnded: "Siaran telah berakhir",
    streamNotStarted: "Siaran belum dimulai",
    watchLiveFromAnywhere: "Ikuti konser dari mana saja.",
    eventDate: "7 Februari 2027",
    accessNotActive: "Akses belum aktif",
    thisStreamIsAvailableToAccounts:
      "Halaman ini hanya tersedia untuk akun dengan tiket livestream yang pembayarannya sudah diverifikasi.",
    viewMyOrders: "Lihat pesanan saya",
    symphonyOfFaithLivestream: "Siaran Symphony of Faith",
    yourAccessIsActiveThePlayer:
      "Akses Anda aktif. Pemutar akan muncul ketika penyelenggara memulai siaran.",
    backToAccount: "Kembali ke akun",
  },
  donationReceived: {
    donationSubmitted: "Niat donasi tercatat",
    yourDonationWillBeCountedAfter:
      "Donasi akan dihitung setelah diverifikasi oleh penyelenggara.",
    backToHome: "Kembali ke beranda",
  },
  loading: {
    loading: "Sedang memuat…",
  },
  notFound: {
    pageNotFound: "Halaman tidak ditemukan.",
    thisLinkMayHaveChanged: "Alamat yang Anda buka mungkin berubah.",
    backToHome: "Kembali ke beranda",
  },
  error: {
    somethingWentWrong: "Permintaan belum berhasil.",
    checkYourDetailsAndTryAgain:
      "Periksa kembali data Anda, lalu coba lagi. Jika masalah berlanjut, hubungi penyelenggara melalui kanal resmi.",
    tryAgain: "Coba lagi",
    backToHome: "Kembali ke beranda",
  },
} as const;

type MessageShape<T> = {
  [Page in keyof T]: { [Key in keyof T[Page]]: string };
};

const en = {
  status: {
    PENDING: "Pending",
    PAYMENT_REVIEW: "Payment review",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    VERIFIED: "Verified",
  },
  account: {
    accessActive: "Active",
    accessInactive: "Inactive",
    accountLabel: "ACCOUNT",
    welcome: "Welcome, ",
    logOut: "Log out",
    accountNavigation: "Account navigation",
    orders: "Orders",
    myTickets: "My tickets",
    bookTickets: "Book tickets",
    home: "Home",
    totalOrders: "Total orders",
    availablePDFs: "Available PDFs",
    livestreamAccess: "Livestream access",
    myOrders: "My orders",
    noOrdersYetChooseATicket: "No orders yet. Choose a ticket when sales open.",
    orderLabel: "ORDER",
    created: "Created",
    expires: "Expires",
    cancelBooking: "Cancel booking",
    transferTo: "Transfer to",
    accountHolder: "Account holder",
    afterTransferringSubmitYourTransactionReference:
      "After transferring, submit your transaction reference. Staff will verify it against the bank statement.",
    transferReference: "Transfer reference",
    submitForVerification: "Submit for verification",
    transferAwaitingStaffReviewTicketsAre:
      "Transfer awaiting staff review. Tickets are not active yet.",
    bookingExpiredBookAgainIfTickets:
      "Booking expired. Book again if tickets are available.",
    yourTicketPDFWillAppearAfter:
      "Your ticket PDF will appear after payment is verified.",
    eventDate: "7 February 2027",
    downloadOriginalPDF: "Download original PDF",
    ticketsLabel: "TICKETS",
    lookingForTickets: "Looking for tickets?",
    exploreTickets: "Explore tickets",
  },
  admin: {
    closeSales: "Close",
    openSales: "Open",
    closedSales: "Closed",
    operationsLabel: "OPERATIONS",
    adminDashboard: "Admin dashboard",
    transactionsAndInventoryFromTheDatabase:
      "Transactions and inventory from the database.",
    myAccount: "My account",
    adminSections: "Admin sections",
    overview: "Overview",
    inventory: "Inventory",
    payments: "Payments",
    donations: "Donations",
    notifications: "Notifications",
    settings: "Settings",
    users: "Users",
    liveOverview: "Live overview",
    confirmedOrders: "Confirmed orders",
    awaitingReview: "Awaiting review",
    verifiedDonations: "Verified donations",
    ordersShowTheLatest100Transactions:
      "Orders show the latest 100 transactions. Totals include all transactions.",
    exportOrdersCSV: "Export orders CSV",
    exportDonationsCSV: "Export donations CSV",
    ticketClassesOriginals: "Ticket classes & originals",
    class: "Class",
    capacity: "Capacity",
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    sales: "Sales",
    recentImports: "Recent imports",
    noPDFImportsYet: "No PDF imports yet.",
    time: "Time",
    needsReview: "Needs review",
    importASinglePDF: "Import a single PDF",
    useTheIssuerSManifestCode:
      "Use the issuer’s manifest code. The PDF must be reviewed before it can be sold.",
    venueClass: "Venue class",
    manifestQRBarcode: "Manifest QR/barcode",
    originalPDF: "Original PDF",
    uploadForReview: "Upload for review",
    noPDFsAwaitingReview: "No PDFs awaiting review.",
    code: "Code",
    approveAgainstManifest: "Approve against manifest",
    checkInTickets: "Check in tickets",
    ticketsCheckedIn: "tickets checked in.",
    barcodeQRFromOriginalPDF: "Barcode/QR from original PDF",
    validateCheckIn: "Validate & check in",
    ordersTransfers: "Orders & transfers",
    searchNameEmailOrID: "Search name, email, or ID",
    all: "All",
    applyFilters: "Apply filters",
    releaseExpiredBookings: "Release expired bookings",
    noOrdersMatchTheseFilters: "No orders match these filters.",
    expires: "Expires",
    customerReference: "Customer reference",
    bankStatementReference: "Bank statement reference",
    statementAmountRp: "Statement amount (Rp)",
    matchesTheBankStatement: "Matches the bank statement",
    verifyTransfer: "Verify transfer",
    noDonationsAwaitingReview: "No donations awaiting review.",
    donorReference: "Donor reference",
    verifyDonation: "Verify donation",
    whatsAppQueue: "WhatsApp queue",
    noNotificationsYet: "No notifications yet.",
    sendingStartsOnceOfficialWhatsAppCredentials:
      "Sending starts once official WhatsApp credentials and templates are configured.",
    streamControls: "Stream controls",
    useTheOfficialYouTubeVideoID:
      "Use the official YouTube video ID. Only accounts with verified access can view the player.",
    youTubeVideoID: "YouTube video ID",
    notStarted: "Not started",
    ended: "Ended",
    saveStreamStatus: "Save stream status",
    paymentAccount: "Payment account",
    accountNumber: "Account number",
    accountHolder: "Account holder",
    saveTransferInstructions: "Save transfer instructions",
    usersRoles: "Users & roles",
    latest50AccountsRoleChangesAre:
      "Latest 50 accounts. Role changes are recorded in the audit log.",
    role: "Role",
    saveRole: "Save role",
  },
  donate: {
    donationsLabel: "DONATIONS",
    giveWithCare: "Give with care.",
    donationsAreRecordedSeparatelyFromTickets:
      "Donations are recorded separately from tickets and counted only after staff confirm the transfer.",
    transferInstructions: "Transfer instructions",
    account: "Account",
    accountHolder: "Account holder",
    enterYourTransferReferenceAfterPayment:
      "Enter your transfer reference after payment. Do not send a donation if the account details differ from the organizer’s official information.",
    donorName: "Donor name",
    donationAmountRp: "Donation amount (Rp)",
    transferReference: "Transfer reference",
    showMeAsAnonymousIfA:
      "Show me as anonymous if a public report is published",
    submitDonationForVerification: "Submit donation for verification",
    donationsAreNotOpenYetOfficial:
      "Donations are not open yet. Official account instructions are being prepared.",
    backToHome: "Back to home",
  },
  donationStatus: {
    verifiedDescription:
      "The transfer has been verified and recorded as received funds.",
    pendingDescription:
      "Your transfer reference has been recorded. Staff will check the bank statement before counting this donation.",
    unverifiedDescription:
      "Your donation has not been verified. If you have transferred funds, contact the organizer through an official channel.",
    donationsLabel: "DONATIONS",
    yourDonationStatus: "Your donation status.",
    reference: "Reference",
    saveThisPageAddressToCheck: "Save this page address to check the status.",
    backToHome: "Back to home",
  },
  livestream: {
    streamEnded: "Stream ended",
    streamNotStarted: "Stream not started",
    watchLiveFromAnywhere: "Watch live from anywhere.",
    eventDate: "7 February 2027",
    accessNotActive: "Access not active",
    thisStreamIsAvailableToAccounts:
      "This stream is available to accounts with a verified livestream ticket.",
    viewMyOrders: "View my orders",
    symphonyOfFaithLivestream: "Symphony of Faith livestream",
    yourAccessIsActiveThePlayer:
      "Your access is active. The player will appear when the organizer starts the stream.",
    backToAccount: "Back to account",
  },
  donationReceived: {
    donationSubmitted: "Donation submitted",
    yourDonationWillBeCountedAfter:
      "Your donation will be counted after the organizer verifies it.",
    backToHome: "Back to home",
  },
  loading: {
    loading: "Loading…",
  },
  notFound: {
    pageNotFound: "Page not found.",
    thisLinkMayHaveChanged: "This link may have changed.",
    backToHome: "Back to home",
  },
  error: {
    somethingWentWrong: "Something went wrong.",
    checkYourDetailsAndTryAgain:
      "Check your details and try again. If the problem continues, contact the organizer through an official channel.",
    tryAgain: "Try again",
    backToHome: "Back to home",
  },
} satisfies MessageShape<typeof id>;

export function secondaryMessages(locale: Locale) {
  return locale === "en" ? en : id;
}

export function secondaryStatus(locale: Locale, status: string) {
  const labels: Record<string, string> = secondaryMessages(locale).status;
  return labels[status] ?? status;
}
