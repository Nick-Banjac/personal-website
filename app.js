fetch('/header.html').then(r => r.text()).then(html => {
    document.getElementById('header').innerHTML = html;
});

fetch('/footer.html').then(r => r.text()).then(html => {
    document.getElementById('footer').innerHTML = html;
});

if (document.querySelector('.mainHeading')) {
    document.querySelectorAll('.mainHeading .line').forEach(line => {
        const words = line.textContent.trim().split(' ');

        line.innerHTML = words.map(word => {
            if (word === '·') return `<span class="dot">·</span>`;

            const chars = word.split('').map((char, i, arr) => {
                const dist = i - Math.floor(arr.length / 2);
                return `<span class="char" data-dist="${dist}">${char}</span>`;
            }).join('');
            return `<span class="word">${chars}</span>`;
        }).join(' ');

        line.querySelectorAll('.word').forEach(word => {
            word.addEventListener('mouseenter', () => {
                word.querySelectorAll('.char').forEach(char => {
                    const dist = parseFloat(char.dataset.dist);
                    char.style.transform = `translateX(${dist * 8}px) scale(1.2)`;
                    char.style.opacity = '0.3';
                    char.style.textShadow = '0 0 12px rgba(255,255,255,0.9), 0 0 30px rgba(255,255,255,0.5)';
                });
            });

            word.addEventListener('mouseleave', () => {
                word.querySelectorAll('.char').forEach(char => {
                    char.style.transform = '';
                    char.style.opacity = '';
                    char.style.textShadow = '';
                });
            });
        });
    });
}

