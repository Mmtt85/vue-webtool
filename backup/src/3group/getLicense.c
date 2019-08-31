#include <stdio.h>
#include <string.h>

int main(int argc, char **argv){
	char buff[128];
	int i=0, j=0, buff_index=0;

	memset(buff, 0x00, sizeof(buff));
	if (argc == 1) {
		printf("%d: %s\n", argc, argv[0]);
	} else {
		for (i = 1; i < argc; i++) {
			for (j = 0; j < strlen(argv[i]); j++){
				buff[buff_index++] = argv[i][j];
			}
			if (i < argc - 1){
				buff[buff_index++] = '<';
				buff[buff_index++] = 'b';
				buff[buff_index++] = 'r';
				buff[buff_index++] = '>';
			}
		}
		printf("%s11111111\n", buff);
	}
	return 0;
}
