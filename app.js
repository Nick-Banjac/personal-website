fetch('/header.html').then(r => r.text()).then(html => {
    document.getElementById('header').innerHTML = html;
});

fetch('/footer.html').then(r => r.text()).then(html => {
    document.getElementById('footer').innerHTML = html;
});

if (document.querySelector('.mainHeading .line')) {
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

        line.querySelectorAll('.char').forEach(char => {
            char.addEventListener('click', () => {
                char.classList.add('jiggle');
                char.addEventListener('animationend', () => {
                    char.classList.remove('jiggle');
                }, { once: true });
            });
        });
    });
}


