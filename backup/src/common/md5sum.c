#include <stdio.h>

extern void md5_hash(char *);

int main(int argc, char **argv) {
	md5_hash("abcd");
    return 0;
}