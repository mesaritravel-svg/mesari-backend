const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());

app.get('/cek-hotel', async (req, res) => {
    const kota = req.query.kota || 'bali'; 
    console.log(`🔍 Mencari di Booking.com untuk lokasi: ${kota}...`);
    
    // 1. Deklarasikan variabel browser di luar try agar bisa diakses catch
    let browser; 

    try {
        // 2. Tambahkan args untuk stabilitas di Windows/VPS
        // Ganti bagian chromium.launch lama Anda dengan ini:
browser = await chromium.launch({ 
    // Menggunakan variabel yang sudah Anda pasang di Railway
    executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH || undefined, 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
});
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        const url = `https://www.booking.com/searchresults.id.html?ss=${kota}&checkin=2026-03-01&checkout=2026-03-02`;
        await page.goto(url, { waitUntil: 'networkidle' });

        // Auto-scroll tetap dipertahankan untuk memancing gambar muncul
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 100;
                let timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if(totalHeight >= 1000){
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await page.waitForTimeout(2000);

        const data = await page.evaluate(() => {
            const list = [];
            const cards = document.querySelectorAll('[data-testid="property-card"]');
            
            cards.forEach(card => {
                const name = card.querySelector('[data-testid="title"]')?.innerText;
                const price = card.querySelector('[data-testid="price-and-discounted-price"]')?.innerText;
                const img = card.querySelector('img')?.src;
                const rating = card.querySelector('[data-testid="review-score"]')?.innerText?.split('\n')[0];
                const location = card.querySelector('[data-testid="address"]')?.innerText;

                if (name && price) {
                    list.push({
                        hotel: name,
                        harga: price,
                        gambar: img || 'https://via.placeholder.com/300x200?text=No+Image',
                        rating: rating || "8.5",
                        lokasi: location || "Indonesia"
                    });
                }
            });
            return list;
        });

        await browser.close();
        res.json({ status: "success", count: data.length, source: "Booking.com", data: data });

    } catch (err) {
        // 3. Hanya tutup browser jika browser memang sudah sempat menyala
        if (browser) await browser.close();
        console.error("EROR:", err.message);
        res.status(500).json({ status: "error", message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));