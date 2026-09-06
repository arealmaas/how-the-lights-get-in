import json, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
d = json.load(open(ROOT / 'programme.json'))
speakers = d['speakers']

# Wikipedia article titles verified via the API on 6 Sept 2026 (exact matches, redirects resolved, namesakes checked).
WIKI = {
 'david-aaronovitch': 'David Aaronovitch', 'tariq-ali': 'Tariq Ali', 'babette-babich': 'Babette Babich', 'philip-ball': 'Philip Ball',
 'shahidha-bari': 'Shahidha Bari', 'torsten-bell': 'Torsten Bell', 'john-bolton': 'John Bolton', 'yaron-brook': 'Yaron Brook',
 'edward-bullmore': 'Ed Bullmore', 'silkie-carlo': 'Silkie Carlo', 'phil-collins': 'Philip Collins (journalist)', 'laila-cunningham': 'Laila Cunningham',
 'tommy-curry': 'Tommy J. Curry', 'rana-dasgupta': 'Rana Dasgupta', 'thangam-debbonaire': 'Thangam Debbonaire', 'divya-dwivedi': 'Divya Dwivedi',
 'david-edmonds': 'David Edmonds (philosopher)', 'norman-finkelstein': 'Norman Finkelstein', 'adam-frank': 'Adam Frank', 'ivette-fuentes': 'Ivette Fuentes',
 'steve-fuller': 'Steve Fuller (sociologist)', 'frank-furedi': 'Frank Furedi', 'rebecca-goldstein': 'Rebecca Goldstein', 'michael-gove': 'Michael Gove',
 'john-gray': 'John Gray (philosopher)', 'aubrey-de-grey': 'Aubrey de Grey', 'sally-haslanger': 'Sally Haslanger', 'roger-hearing': 'Roger Hearing',
 'thomas-hertog': 'Thomas Hertog', 'isabel-hilton': 'Isabel Hilton', 'sabine-hossenfelder-2': 'Sabine Hossenfelder', 'wang-hui': 'Wang Hui (intellectual)',
 'jeremy-hunt': 'Jeremy Hunt', 'bryan-johnson': 'Bryan Johnson', 'joanna-kavenna': 'Joanna Kavenna', 'steve-keen': 'Steve Keen',
 'kwasi-kwarteng': 'Kwasi Kwarteng', 'hilary-lawson': 'Hilary Lawson', 'catherine-liu': 'Catherine Liu', 'patricia-lockwood': 'Patricia Lockwood',
 'steven-lukes': 'Steven Lukes', 'kishore-mahbubani': 'Kishore Mahbubani', 'sebastian-mallaby': 'Sebastian Mallaby', 'mariana-mazzucato': 'Mariana Mazzucato',
 'deirdre-mccloskey': 'Deirdre McCloskey', 'alister-mcgrath': 'Alister McGrath', 'rachel-millward': 'Rachel Millward', 'joanna-moncrieff': 'Joanna Moncrieff',
 'priya-natarajan': 'Priyamvada Natarajan', 'dasha-nekrasova': 'Dasha Nekrasova', 'sabrina-pasterski': 'Sabrina Pasterski', 'janos-pasztor': 'Janos Pasztor (diplomat)',
 'laurie-penny': 'Laurie Penny', 'roger-penrose': 'Roger Penrose', 'agnieszka-piotrowska': 'Agnieszka Piotrowska', 'malcolm-rifkind': 'Malcolm Rifkind',
 'sebastian-roedl': 'Sebastian Rödl', 'tony-d-sampson': 'Tony D. Sampson', 'will-self': 'Will Self', 'mary-ann-sieghart': 'Mary Ann Sieghart',
 'barry-c-smith': 'Barry C. Smith', 'mark-solms': 'Mark Solms', 'david-spiegelhalter': 'David Spiegelhalter', 'jordan-stephens': 'Jordan Stephens',
 'galen-strawson': 'Galen Strawson', 'nicola-sturgeon': 'Nicola Sturgeon', 'daniel-susskind': 'Daniel Susskind', 'gillian-tett': 'Gillian Tett',
 'louis-theroux': 'Louis Theroux', 'neil-turok': 'Neil Turok', 'antony-valentini': 'Antony Valentini', 'leo-varadkar': 'Leo Varadkar',
 'jimmy-wales': 'Jimmy Wales', 'daniel-whiteson': 'Daniel Whiteson', 'heather-widdows': 'Heather Widdows', 'emily-wilson': 'Emily Wilson (classicist)',
 'sarah-wilson': 'Sarah Wilson (journalist)', 'martin-wolf': 'Martin Wolf', 'michael-wooldridge': 'Michael Wooldridge (computer scientist)',
}

# Selected books, from the speakers' published work. Year omitted where uncertain.
BOOKS = {
 'david-aaronovitch': [('Voodoo Histories', 2009), ('Party Animals', 2016)],
 'tariq-ali': [('Street Fighting Years', 1987), ('The Extreme Centre', 2015), ('Winston Churchill: His Times, His Crimes', 2022)],
 'babette-babich': [('The Hallelujah Effect', 2013), ("Nietzsche's Philosophy of Science", 1994)],
 'maria-balaska': [('Wittgenstein and Lacan at the Limit', 2019)],
 'philip-ball': [('Beyond Weird', 2018), ('How Life Works', 2023), ('Critical Mass', 2004)],
 'shahidha-bari': [('Dressed: The Secret Life of Clothes', 2019)],
 'torsten-bell': [('Great Britain? How We Get Our Future Back', 2024)],
 'john-bolton': [('The Room Where It Happened', 2020)],
 'audrey-borowski': [('Leibniz in His World: The Making of a Savant', 2024)],
 'yaron-brook': [('Free Market Revolution (with Don Watkins)', 2012), ('Equal Is Unfair (with Don Watkins)', 2016)],
 'adrienne-buller': [('The Value of a Whale', 2022), ('Owning the Future (with Mathew Lawrence)', 2022)],
 'edward-bullmore': [('The Inflamed Mind', 2018)],
 'rana-dasgupta': [('Capital: The Eruption of Delhi', 2014), ('Solo', 2009)],
 'divya-dwivedi': [('Gandhi and Philosophy (with Shaj Mohan)', 2019), ('Indian Philosophy, Indian Revolution (with Shaj Mohan)', 2024)],
 'david-edmonds': [("Wittgenstein's Poker (with John Eidinow)", 2001), ('The Murder of Professor Schlick', 2020), ('Parfit: A Philosopher and His Mission to Save Morality', 2023)],
 'bjorn-ekeberg': [('Metaphysical Experiments: Physics and the Invention of the Universe', 2019)],
 'norman-finkelstein': [('The Holocaust Industry', 2000), ('Gaza: An Inquest into Its Martyrdom', 2018), ("Gaza's Gravediggers", None)],
 'adam-frank': [('Light of the Stars', 2018), ('The Little Book of Aliens', 2023), ('The Blind Spot (with Marcelo Gleiser and Evan Thompson)', 2024)],
 'steve-fuller': [('Post-Truth: Knowledge as a Power Game', 2018), ('Humanity 2.0', 2011)],
 'frank-furedi': [('Culture of Fear', 1997), ('How Fear Works', 2018), ('Why Borders Matter', 2020), ('100 Years of Identity Crisis', 2021), ('The War Against the Past', 2024)],
 'rebecca-goldstein': [('Plato at the Googleplex', 2014), ('Betraying Spinoza', 2006), ('36 Arguments for the Existence of God', 2010), ('The Mind-Body Problem', 1983)],
 'michael-gove': [('Celsius 7/7', 2006)],
 'john-gray': [('Straw Dogs', 2002), ('The Immortalization Commission', 2011), ('Feline Philosophy', 2020), ('The New Leviathans', 2023)],
 'aubrey-de-grey': [('Ending Aging (with Michael Rae)', 2007)],
 'sally-haslanger': [('Resisting Reality', 2012)],
 'thomas-hertog': [('On the Origin of Time', 2023)],
 'isabel-hilton': [('The Search for the Panchen Lama', 1999)],
 'sabine-hossenfelder-2': [('Lost in Math', 2018), ('Existential Physics', 2022)],
 'wang-hui': [("China's New Order", 2003), ('The End of the Revolution', 2009), ('China from Empire to Nation-State', 2014)],
 'jeremy-hunt': [('Can We Be Great Again?', 2025), ('Zero: Eliminating Unnecessary Deaths in a Post-Pandemic NHS', 2022)],
 'bryan-johnson': [("Don't Die", 2023)],
 'joanna-kavenna': [('Zed', 2019), ('A Field Guide to Reality', 2016), ('The Ice Museum', 2005)],
 'steve-keen': [('Debunking Economics', 2011), ('The New Economics: A Manifesto', 2021)],
 'laura-kennedy': [('Some of Our Parts', 2024)],
 'kwasi-kwarteng': [('Ghosts of Empire', 2011), ('War and Gold', 2014), ("Thatcher's Trial", 2015)],
 'hilary-lawson': [('Closure: A Story of Everything', 2001), ('Reflexivity: The Post-Modern Predicament', 1985)],
 'laurie-laybourn': [('Planet on Fire (with Mathew Lawrence)', 2021)],
 'catherine-liu': [('Virtue Hoarders: The Case Against the Professional Managerial Class', 2021), ('American Idyll', 2011)],
 'patricia-lockwood': [('Priestdaddy', 2017), ('No One Is Talking About This', 2021), ('Will There Ever Be Another You', 2025)],
 'steven-lukes': [('Power: A Radical View', 1974)],
 'kishore-mahbubani': [('Has China Won?', 2020), ('The Asian 21st Century', 2022), ('Living the Asian Century', 2024)],
 'sebastian-mallaby': [('The Power Law', 2022), ('More Money Than God', 2010), ('The Man Who Knew: The Life and Times of Alan Greenspan', 2016)],
 'mariana-mazzucato': [('The Entrepreneurial State', 2013), ('The Value of Everything', 2018), ('Mission Economy', 2021), ('The Big Con (with Rosie Collington)', 2023), ('The Common Good Economy', None)],
 'deirdre-mccloskey': [('The Bourgeois Virtues', 2006), ('Bourgeois Dignity', 2010), ('Bourgeois Equality', 2016), ('Why Liberalism Works', 2019)],
 'alister-mcgrath': [('The Dawkins Delusion? (with Joanna Collicutt McGrath)', 2007), ('C. S. Lewis: A Life', 2013)],
 'joanna-moncrieff': [('The Myth of the Chemical Cure', 2008), ('Chemically Imbalanced', 2025)],
 'priya-natarajan': [('Mapping the Heavens', 2016)],
 'laurie-penny': [('Unspeakable Things', 2014), ('Bitch Doctrine', 2017), ('Sexual Revolution', 2022)],
 'roger-penrose': [("The Emperor's New Mind", 1989), ('The Road to Reality', 2004), ('Cycles of Time', 2010), ('Fashion, Faith, and Fantasy in the New Physics of the Universe', 2016)],
 'agnieszka-piotrowska': [('Psychoanalysis and Ethics in Documentary Film', 2014), ('The Nasty Woman and the Neo Femme Fatale in Contemporary Cinema', 2019)],
 'malcolm-rifkind': [('Power and Pragmatism', 2016)],
 'sebastian-roedl': [('Self-Consciousness', 2007), ('Self-Consciousness and Objectivity', 2018)],
 'tony-d-sampson': [('Virality: Contagion Theory in the Age of Networks', 2012), ('The Assemblage Brain', 2017), ("A Sleepwalker's Guide to Social Media", 2020)],
 'danielle-sands': [('Animal Writing: Storytelling, Selfhood and the Limits of Empathy', 2019)],
 'will-self': [('Great Apes', 1997), ('Umbrella', 2012), ('Will', 2019), ('Elaine', 2024)],
 'mary-ann-sieghart': [('The Authority Gap', 2021)],
 'barry-c-smith': [('Questions of Taste: The Philosophy of Wine (ed.)', 2007)],
 'mark-solms': [('The Hidden Spring', 2021), ('The Brain and the Inner World (with Oliver Turnbull)', 2002)],
 'david-spiegelhalter': [('The Art of Statistics', 2019), ('The Art of Uncertainty', 2024), ('The Norm Chronicles (with Michael Blastland)', 2013)],
 'jordan-stephens': [('Avoidance, Drugs, Heartbreak and Dogs', 2024)],
 'galen-strawson': [('Selves', 2009), ('Things That Bother Me', 2018), ('Freedom and Belief', 1986)],
 'nicola-sturgeon': [('Frankly', 2025)],
 'daniel-susskind': [('A World Without Work', 2020), ('Growth: A Reckoning', 2024), ('The Future of the Professions (with Richard Susskind)', 2015)],
 'jack-symes': [('Philosophers on Consciousness (ed.)', 2022)],
 'gillian-tett': [("Fool's Gold", 2009), ('The Silo Effect', 2015), ('Anthro-Vision', 2021)],
 'louis-theroux': [('Gotta Get Theroux This', 2019), ('The Call of the Weird', 2005)],
 'jonny-thomson': [('Mini Philosophy', 2021), ('Mini Big Ideas', 2023)],
 'neil-turok': [('The Universe Within', 2012), ('Endless Universe (with Paul Steinhardt)', 2007)],
 'leo-varadkar': [('Speaking My Mind', 2025)],
 'melvin-vopson': [('Reality Reloaded', 2023)],
 'jimmy-wales': [('The Seven Rules of Trust', 2025)],
 'andy-west': [('The Life Inside', 2022)],
 'daniel-whiteson': [('We Have No Idea (with Jorge Cham)', 2017), ('Frequently Asked Questions About the Universe (with Jorge Cham)', 2021)],
 'heather-widdows': [('Perfect Me', 2018)],
 'emily-wilson': [('The Odyssey (translation)', 2017), ('The Iliad (translation)', 2023)],
 'sarah-wilson': [('First, We Make the Beast Beautiful', 2017), ('This One Wild and Precious Life', 2020), ('I Quit Sugar', 2012)],
 'martin-wolf': [('The Crisis of Democratic Capitalism', 2023), ('The Shifts and the Shocks', 2014), ('Why Globalization Works', 2004)],
 'michael-wooldridge': [('The Road to Conscious Machines', 2020), ('An Introduction to MultiAgent Systems', 2002)],
 'peter-worley': [('The If Machine', 2011), ('40 Lessons to Get Children Thinking', 2015)],
}

out = {'_meta': {'note': 'Wikipedia articles were resolved through the Wikipedia API on 6 September 2026 and checked against the festival bios (namesakes excluded). Books are a selection of the speakers\' published work; years are omitted where unsure. IAI TV links open the festival organiser\'s own video archive search.'}, 'speakers': {}}
for s in speakers:
    key = s['slug'] or s['name'].lower().replace(' ', '-')
    entry = {}
    if key in WIKI:
        entry['wikipedia'] = 'https://en.wikipedia.org/wiki/' + urllib.parse.quote(WIKI[key].replace(' ', '_'))
    entry['iaiTv'] = 'https://iai.tv/search-results?query=' + urllib.parse.quote(s['name'])
    entry['books'] = [{'title': t, 'year': y} for t, y in BOOKS.get(key, [])]
    out['speakers'][key] = entry
json.dump(out, open(ROOT / 'data' / 'speakers-extra.json', 'w'), ensure_ascii=False, indent=1)
print(len(out['speakers']), 'speakers;', sum(1 for v in out['speakers'].values() if 'wikipedia' in v), 'with Wikipedia;', sum(1 for v in out['speakers'].values() if v['books']), 'with books;', sum(len(v['books']) for v in out['speakers'].values()), 'books')
missing = [k for k in BOOKS if k not in out['speakers']] + [k for k in WIKI if k not in out['speakers']]
print('keys not matching a speaker slug:', missing)
