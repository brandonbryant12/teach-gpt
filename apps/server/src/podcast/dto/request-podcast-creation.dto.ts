import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { DeepDiveOption } from '../interfaces/podcast.interface';

export class RequestPodcastCreationDto {
  @ApiProperty({
    description: 'The URL of the web article to convert into a podcast',
    example: 'https://example.com/news/article123',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  url: string;

  @ApiProperty({
    description:
      'Specifies the desired depth/style for the podcast content generation',
    enum: ['CONDENSE', 'RETAIN', 'EXPAND'],
    example: 'RETAIN',
  })
  @IsNotEmpty()
  @IsEnum(['CONDENSE', 'RETAIN', 'EXPAND'])
  deepDiveOption: DeepDiveOption;
}
