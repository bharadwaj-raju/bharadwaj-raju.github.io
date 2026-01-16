/* Adapted heavily from https://benfrain.com/building-a-table-of-contents-with-active-indicator-using-javascript-intersection-observers/ */

window.onload = () => {
    const links = [...document.querySelectorAll('.toc a')];
    const hashes = links.map(link => "#" + link.getAttribute("href").split("#")[1]);
    const sections = links.map(link => document.querySelector("#" + link.getAttribute("href").split("#")[1]));

    function getLinkForSection(section) {
      if (section === null) {
        return null;
      }
      for (const link of links) {
        if (link.getAttribute("href").split("#")[1] === section.id) {
          return link;
        }
      }
      return null;
    }

    function highlightLink(link) {
      links.forEach(link => link.classList.remove("active"));
      if (link === null) {
        return;
      }
      link.classList.add("active");
    }

    // two observers: one for the vertical median, one for the bottom edge, since we want to
    // trigger recomputation on both
    
    const observeHtags = new IntersectionObserver(setCurrent, {
      root: null,
      // don't set both top and bottom, that makes it unreliable
      rootMargin: "0px 0px -50% 0px",
      threshold: 0.0,
    });

    const observeHtags2 = new IntersectionObserver(setCurrent, {
      root: null,
      rootMargin: "0px 0px 0px 0px",
      threshold: 0.0,
    })
  
    const toc = document.getElementsByClassName("toc")[0];
  
    // highlight first one if visible
    if (sections.length >= 1 && sections[0].getBoundingClientRect().top + window.scrollY < (window.innerHeight / 2)) {
      highlightLink(links[0]);
    }
  
    // if we have a hash highlight that initially instead of basing on visible
    if (hashes.includes(location.hash)) {
      highlightLink(document.querySelector(`a[href="${location.href}"]`));
    }
  
    function setCurrent(_e) {
      const median = window.innerHeight / 2;
      let activeSection = null;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top < median) {
          activeSection = section;
        } else {
          break;
        }
      }
      highlightLink(getLinkForSection(activeSection));
    }
  
    sections.forEach(h => { observeHtags.observe(h); observeHtags2.observe(h); });
  
    // if we click a toc link, highlight that regardless of its scroll position
    links.forEach(link => {
      link.addEventListener("click", e => {
        setTimeout(function() {
          highlightLink(document.querySelector(`a[href="${location.href}"]`));
        }, 50);
        setTimeout(function() {
          highlightLink(document.querySelector(`a[href="${location.href}"]`));
        }, 500);
      })
    });
  };
  
