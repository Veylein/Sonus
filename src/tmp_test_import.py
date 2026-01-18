import importlib
m = importlib.import_module('src.audio.queue')
print('module', m)
print('has TrackQueue?', hasattr(m, 'TrackQueue'))
print([n for n in dir(m) if 'Track' in n or 'Queue' in n])
