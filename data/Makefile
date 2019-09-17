INPUT_FILES = \
  offshore_leaks.edges.csv \
  offshore_leaks.nodes.address.csv \
  offshore_leaks.nodes.entity.csv \
  offshore_leaks.nodes.intermediary.csv \
  offshore_leaks.nodes.officer.csv

all: edges/officer_of.csv

.PHONY: clean all

clean:
	rm *.csv *.zip

csv_offshore_leaks.2018-02-14.zip:
	wget https://offshoreleaks-data.icij.org/offshoreleaks/csv/csv_offshore_leaks.2018-02-14.zip

offshore_leaks.edges.csv: csv_offshore_leaks.2018-02-14.zip
	unzip -o -q csv_offshore_leaks.2018-02-14.zip -d .

offshore_leaks.corrected.edges.csv: offshore_leaks.edges.csv
	awk -F ',' -v OFS=',' ' { t = $$2; $$2 = $$3; $$3 = t; print; } ' offshore_leaks.edges.csv > $@

edges/officer_of.csv: offshore_leaks.corrected.edges.csv
	mkdir -p edges
	awk -F, 'NR==1 {h=$$0; next} {f='\"'edges/'\"'substr($$3,2,length($$3)-2)'\"'.csv"} !($$3 in p) {p[$$3]; print h > f} {print >> f}' offshore_leaks.corrected.edges.csv

