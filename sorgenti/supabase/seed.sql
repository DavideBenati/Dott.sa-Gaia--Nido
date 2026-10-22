-- Editorial categories contain no personal data or medical claims.
insert into public.article_categories(id,name,icon) values
('pregnancy','Gravidanza','sunny-outline'),('preparation','Preparazione al parto','bag-outline'),
('birth','Travaglio e nascita','flower-outline'),('recovery','Puerperio e recupero','leaf-outline'),
('breastfeeding','Allattamento al seno','heart-outline'),('feeding','Alimentazione del neonato','water-outline'),
('wellbeing','Benessere emotivo','happy-outline'),('partner','Il ruolo del partner','people-outline'),
('home','Primi giorni a casa','home-outline') on conflict(id) do nothing;
-- No demonstration article is seeded as approved or published.
