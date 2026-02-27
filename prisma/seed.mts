import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  { name: "Groceries", keywords: ["walmart", "kroger", "whole foods", "trader joe", "safeway", "grocery", "market", "aldi", "costco", "publix", "food lion", "wegmans", "sprouts", "heb", "piggly", "winn dixie", "stop & shop", "giant eagle", "meijer", "winco", "food mart", "fresh market"], color: "#22c55e", icon: "ShoppingCart" },
  { name: "Dining", keywords: ["restaurant", "mcdonald", "starbucks", "chipotle", "subway", "pizza", "burger", "cafe", "coffee", "doordash", "uber eats", "grubhub", "diner", "taco", "wendy", "chick-fil-a", "panda express", "panera", "dunkin", "popeye", "sonic drive", "five guys", "wingstop", "domino", "papa john", "jack in the box", "in-n-out", "noodle", "sushi", "thai", "pho", "ramen", "bakery", "deli", "smoothie", "juice bar", "waffle", "ihop", "dennys", "applebee", "olive garden", "chilis", "outback", "red lobster", "cheesecake factory"], color: "#f97316", icon: "UtensilsCrossed" },
  { name: "Utilities", keywords: ["electric", "water bill", "gas bill", "phone bill", "utility", "comcast", "verizon", "at&t", "t-mobile", "power", "sewage", "spectrum", "xfinity", "cox", "centurylink", "frontier", "windstream", "duke energy", "pg&e", "pge", "pgande", "edison", "municipal", "trash", "waste", "sanitation"], color: "#3b82f6", icon: "Zap" },
  { name: "Rent & Mortgage", keywords: ["rent", "lease", "mortgage", "housing", "apartment", "property", "hoa", "homeowner", "biltpymts", "bilt"], color: "#8b5cf6", icon: "Home" },
  { name: "Transportation", keywords: ["uber", "lyft", "gas station", "shell", "chevron", "bp", "exxon", "transit", "parking", "toll", "metro", "fuel", "car wash", "supercharger", "tesla supercharger", "chargepoint", "ev charge", "electrify", "arco", "sunoco", "valero", "marathon", "speedway", "circle k", "wawa", "auto repair", "jiffy lube", "midas", "tire", "autozone", "o'reilly", "napa auto", "advance auto", "car parts", "dmv", "registration"], color: "#06b6d4", icon: "Car" },
  { name: "Entertainment", keywords: ["netflix", "spotify", "hulu", "disney", "movie", "theater", "gaming", "steam", "playstation", "xbox", "concert", "ticket", "apple music", "youtube", "twitch", "paramount", "peacock", "hbo", "max", "prime video", "crunchyroll", "audible", "kindle", "books", "museum", "zoo", "amusement", "theme park", "bowling", "arcade", "golf", "gym", "fitness", "peloton", "planet fitness", "equinox", "ymca", "24 hour fitness"], color: "#ec4899", icon: "Film" },
  { name: "Shopping", keywords: ["amazon", "target", "best buy", "apple store", "clothing", "nike", "adidas", "mall", "store", "ebay", "etsy", "dollartree", "dollar tree", "dollar general", "family dollar", "five below", "marshalls", "tj maxx", "ross", "nordstrom", "macys", "jcpenney", "kohls", "old navy", "gap", "h&m", "zara", "shein", "temu", "wish", "alibaba", "wayfair", "ikea", "home depot", "lowes", "menards", "ace hardware", "bed bath", "pottery barn", "crate barrel", "pier 1", "michaels", "hobby lobby", "joann", "office depot", "staples", "true nutrition", "truenutrition", "nutrition", "supplement", "vitamin", "gnc", "bodybuilding", "myprotein", "iherb"], color: "#a855f7", icon: "ShoppingBag" },
  { name: "Healthcare", keywords: ["pharmacy", "cvs", "walgreens", "doctor", "hospital", "medical", "dental", "health care", "stanford health", "kaiser", "insurance premium", "clinic", "lab", "prescription", "optometrist", "vision", "eye care", "dermatolog", "urgent care", "emergency", "therapy", "counseling", "mental health", "chiropract", "physical therapy", "med*", "rite aid", "express scripts", "caremark", "cigna", "aetna", "united health", "blue cross", "anthem", "humana"], color: "#ef4444", icon: "Heart" },
  { name: "Interest & Fees", keywords: ["interest charge", "purchase interest", "cash advance interest", "annual fee", "late fee", "over limit fee", "finance charge", "service charge", "monthly fee", "maintenance fee", "atm fee", "foreign transaction fee", "balance transfer fee", "returned payment fee", "minimum interest"], color: "#dc2626", icon: "Percent" },
  { name: "Income", keywords: ["payroll", "direct deposit", "salary", "wage", "dividend", "interest earned", "refund", "cashback", "deposit", "reimbursement", "bonus", "commission", "freelance", "payment received", "venmo received", "zelle received"], color: "#10b981", icon: "DollarSign" },
  { name: "Credit Card Payment", keywords: ["automatic payment", "autopay", "payment thank you", "payment - thank", "online payment", "bill pay", "credit card payment", "payment from chk", "payment from sav", "crcardpmt", "credit crd", "applecard", "gsbank", "card bill payment"], color: "#059669", icon: "CreditCard" },
  { name: "Transfer", keywords: ["transfer", "zelle", "venmo", "paypal", "cash app", "wire transfer", "ach", "robinhood", "vanguard buy", "acorns", "wealthfront", "ally bank", "atm withdr", "bkofamerica atm"], color: "#6b7280", icon: "ArrowLeftRight" },
  { name: "Subscriptions", keywords: ["subscription", "monthly plan", "annual plan", "membership", "patreon", "substack", "medium", "notion", "dropbox", "google storage", "icloud", "adobe", "microsoft 365", "office 365", "github", "linkedin premium", "chatgpt", "openai", "canva", "figma", "slack", "zoom", "grammarly"], color: "#0ea5e9", icon: "RefreshCw" },
  { name: "Uncategorized", keywords: [], color: "#9ca3af", icon: "HelpCircle" },
];

async function main() {
  // Remove old renamed categories
  const oldNames = ["Rent", "Transfer", "Transfer & Payment"];
  for (const name of oldNames) {
    await prisma.category.deleteMany({ where: { name } });
  }

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { keywords: JSON.stringify(cat.keywords), color: cat.color, icon: cat.icon },
      create: { name: cat.name, keywords: JSON.stringify(cat.keywords), color: cat.color, icon: cat.icon },
    });
  }
  console.log("Seeded categories successfully");

  // Create default Household + User if none exist
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    let household = await prisma.household.findFirst();
    if (!household) {
      household = await prisma.household.create({
        data: { name: "My Household" },
      });
      console.log("Created default household");
    }
    const user = await prisma.user.create({
      data: { name: "Default", householdId: household.id },
    });
    console.log(`Created default user: ${user.name} (${user.id})`);

    // Assign any existing accounts to this user
    const updated = await prisma.account.updateMany({
      where: { userId: null },
      data: { userId: user.id },
    });
    if (updated.count > 0) {
      console.log(`Assigned ${updated.count} existing accounts to default user`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
